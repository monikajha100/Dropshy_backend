const express = require("express");
const pool = require("./pool");
const upload = require("./multer");
// const verifyToken = require("./middleware/verifyToken"); // login system bante hi ye wapas enable karna

const router = express.Router();

// Slug generator
const slugify = (text = "") =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// Introduction heading + content + points
const buildIntroductionHtml = (heading, content, points = []) => {
  const parts = [];

  if (heading) {
    parts.push(`<h3>${heading}</h3>`);
  }

  if (content) {
    parts.push(`<p>${content}</p>`);
  }

  const cleanPoints = points.filter((p) => p && p.trim());

  if (cleanPoints.length) {
    parts.push(
      `<ul>${cleanPoints.map((p) => `<li>${p}</li>`).join("")}</ul>`
    );
  }

  return parts.join("");
};

// POST /api/blogs/submit_blog
router.post(
  "/blogs/submit_blog",
  upload.single("bannerImage"),
  async (req, res) => {
    let conn;

    try {
      conn = await pool.getConnection();

      const {
        title,
        metaTitle,
        h1Heading,
        metaDescription,
        introductionHeading,
        introductionContent,
        overviewHeading,
        overviewContent,
        businessModelTitle,
        faqHeading,
        status,
      } = req.body;

      // Title validation
      if (!title || !title.trim()) {
        return res.json({
          status: false,
          message: "Title is required",
        });
      }

      // Parse JSON arrays safely
      let introductionPoints = [];
      let steps = [];
      let faqs = [];

      try {
        introductionPoints = JSON.parse(
          req.body.introductionPoints || "[]"
        );
      } catch (e) {
        return res.json({
          status: false,
          message: "Invalid introduction points data",
        });
      }

      try {
        steps = JSON.parse(req.body.steps || "[]");
      } catch (e) {
        return res.json({
          status: false,
          message: "Invalid steps data",
        });
      }

      try {
        faqs = JSON.parse(req.body.faqs || "[]");
      } catch (e) {
        return res.json({
          status: false,
          message: "Invalid FAQ data",
        });
      }

      // Slug
      const slug = req.body.slug?.trim()
        ? slugify(req.body.slug)
        : slugify(title);

      // Introduction HTML
      const introductionHtml = buildIntroductionHtml(
        introductionHeading,
        introductionContent,
        introductionPoints
      );

      // Uploaded banner image
      const bannerImage = req.file
        ? `/images/${req.file.filename}`
        : null;

      // Start transaction
      await conn.beginTransaction();

      // Insert blog
      // Raw introductionHeading/introductionContent/introductionPoints are
      // now saved as their own columns too (in addition to the combined
      // `introduction` HTML), so display_all / GET :id can return them
      // individually for edit screens etc.
      const [blogResult] = await conn.query(
        `INSERT INTO blogs
          (
            title,
            slug,
            meta_title,
            h1_heading,
            meta_description,
            banner_image,
            introduction,
            introduction_heading,
            introduction_content,
            introduction_points,
            overview_title,
            overview_content,
            business_model_title,
            faq_section_title,
            status
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          slug,
          metaTitle || null,
          h1Heading || null,
          metaDescription || null,
          bannerImage,
          introductionHtml,
          introductionHeading || null,
          introductionContent || null,
          JSON.stringify(introductionPoints || []),
          overviewHeading || null,
          overviewContent || null,
          businessModelTitle || null,
          faqHeading || null,
          status === "published" ? "published" : "draft",
        ]
      );

      const blogId = blogResult.insertId;

      // Insert steps
      const cleanSteps = steps.filter(
        (s) =>
          s &&
          (s.title?.trim() || s.description?.trim())
      );

      if (cleanSteps.length) {
        const stepRows = cleanSteps.map((s, i) => [
          blogId,
          i + 1,
          s.title || "",
          s.description || "",
        ]);

        await conn.query(
          `INSERT INTO blog_steps
            (blog_id, step_number, title, description)
           VALUES ?`,
          [stepRows]
        );
      }

      // Insert FAQs
      const cleanFaqs = faqs.filter(
        (f) =>
          f &&
          (f.question?.trim() || f.answer?.trim())
      );

      if (cleanFaqs.length) {
        const faqRows = cleanFaqs.map((f, i) => [
          blogId,
          i + 1,
          f.question || "",
          f.answer || "",
        ]);

        await conn.query(
          `INSERT INTO blog_faqs
            (blog_id, faq_order, question, answer)
           VALUES ?`,
          [faqRows]
        );
      }

      // Commit
      await conn.commit();

      console.log("Blog saved successfully:", {
        id: blogId,
        slug,
        bannerImage,
        status,
      });

      return res.json({
        status: true,
        message:
          status === "published"
            ? "Blog published successfully"
            : "Draft saved successfully",
        id: blogId,
        slug,
        bannerImage,
      });
    } catch (err) {
      console.error("FAILED TO SAVE BLOG:", err);

      // Rollback if connection exists
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError);
        }
      }

      // Duplicate slug
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          status: false,
          message: "A blog with this slug already exists",
        });
      }

      // MySQL errors
      return res.status(500).json({
        status: false,
        message: err.message || "Failed to save blog",
        error: err.code || null,
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

// GET /api/blogs/display_all — list ALL blogs with EVERY field that
// submit_blog stores, including steps + faqs (aggregated as JSON arrays
// via subqueries so the admin table doesn't need N+1 requests).
// NOTE: verifyToken temporarily removed — login/token system abhi nahi bana hai.
router.get("/blogs/display_all", /* verifyToken, */ async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          b.*,
          (
            SELECT JSON_ARRAYAGG(
                     JSON_OBJECT(
                       'title', s.title,
                       'description', s.description,
                       'step_number', s.step_number
                     )
                   )
            FROM blog_steps s
            WHERE s.blog_id = b.id
          ) AS steps,
          (
            SELECT JSON_ARRAYAGG(
                     JSON_OBJECT(
                       'question', f.question,
                       'answer', f.answer,
                       'faq_order', f.faq_order
                     )
                   )
            FROM blog_faqs f
            WHERE f.blog_id = b.id
          ) AS faqs
       FROM blogs b
       ORDER BY b.created_at DESC`
    );

    // JSON_ARRAYAGG returns NULL (not []) when a blog has zero steps/faqs —
    // normalize that here so the frontend always gets an array. Also parse
    // introduction_points back from its stored JSON string.
    const normalized = rows.map((row) => {
      let introductionPoints = [];
      try {
        introductionPoints = JSON.parse(row.introduction_points || "[]");
      } catch (e) {
        introductionPoints = [];
      }

      return {
        ...row,
        steps: row.steps || [],
        faqs: row.faqs || [],
        introduction_points: introductionPoints,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Success",
      data: normalized,
    });
  } catch (err) {
    console.error("FAILED TO FETCH BLOGS:", err);
    return res.status(200).json({
      status: false,
      message: "Database Error..Pls Contact DBA...",
    });
  }
});

// GET /api/blogs/:id — single blog with its steps + faqs joined in
// (used for view/edit screens, since submit_blog stores steps/faqs
// in their own tables keyed by blog_id)
// NOTE: verifyToken temporarily removed — login/token system abhi nahi bana hai.
router.get("/blogs/:id", /* verifyToken, */ async (req, res) => {
  try {
    const blogId = req.params.id;

    const [blogRows] = await pool.query(
      `SELECT * FROM blogs WHERE id = ?`,
      [blogId]
    );

    if (!blogRows.length) {
      return res.status(200).json({
        status: false,
        message: "Blog not found",
      });
    }

    const [steps] = await pool.query(
      `SELECT step_number, title, description
       FROM blog_steps
       WHERE blog_id = ?
       ORDER BY step_number ASC`,
      [blogId]
    );

    const [faqs] = await pool.query(
      `SELECT faq_order, question, answer
       FROM blog_faqs
       WHERE blog_id = ?
       ORDER BY faq_order ASC`,
      [blogId]
    );

    return res.status(200).json({
      status: true,
      message: "Success",
      data: {
        ...blogRows[0],
        steps,
        faqs,
      },
    });
  } catch (err) {
    console.error("FAILED TO FETCH BLOG:", err);
    return res.status(200).json({
      status: false,
      message: "Database Error..Pls Contact DBA...",
    });
  }
});

// DELETE /api/blogs/:id — delete a blog (and its related steps/faqs)
// NOTE: verifyToken temporarily removed — login/token system abhi nahi bana hai.
router.delete("/blogs/:id", /* verifyToken, */ async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const blogId = req.params.id;

    const [existing] = await conn.query(
      `SELECT id FROM blogs WHERE id = ?`,
      [blogId]
    );

    if (!existing.length) {
      return res.status(200).json({
        status: false,
        message: "Blog not found",
      });
    }

    await conn.beginTransaction();

    await conn.query(`DELETE FROM blog_steps WHERE blog_id = ?`, [blogId]);
    await conn.query(`DELETE FROM blog_faqs WHERE blog_id = ?`, [blogId]);
    await conn.query(`DELETE FROM blogs WHERE id = ?`, [blogId]);

    await conn.commit();

    return res.status(200).json({
      status: true,
      message: "Blog deleted successfully",
    });
  } catch (err) {
    console.error("FAILED TO DELETE BLOG:", err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    return res.status(200).json({
      status: false,
      message: "Database Error..Pls Contact DBA...",
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;