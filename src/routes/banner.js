// ======================================================
// FILE: C:\Dropsy_backend\src\routes\banner.js
// ======================================================

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// pool.js isi folder me hai: C:\Dropsy_backend\src\routes\pool.js
const pool = require("./pool");

const router = express.Router();


// ======================================================
// UPLOAD FOLDER  ->  C:\Dropsy_backend\uploads\banners
// (__dirname = C:\Dropsy_backend\src\routes)
// ======================================================

const uploadDir = path.join(__dirname, "..", "..", "uploads", "banners");

fs.mkdirSync(uploadDir, { recursive: true });


// ======================================================
// PAGES + KITNE BANNERS ALLOWED HAIN
// (frontend ke page ids se same hone chahiye)
// ======================================================

const MAX_BANNERS = {
    home: 3,
    about: 3,
    services: 1,
    national: 1,
    international: 1,
    ecommerce: 1,
    contact: 1
};


// ======================================================
// TERMINAL DEBUG HELPERS
// ======================================================

// MySQL error code ko simple bhasha me samjhata hai
const explainDbError = (error) => {
    switch (error.code) {
        case "ER_NO_SUCH_TABLE":
            return "'banners' table database me nahi hai -> banners.sql run karo";
        case "ER_BAD_FIELD_ERROR":
            return "banners table me koi column missing/galat hai -> MySQL me DESCRIBE banners; chalao";
        case "ER_BAD_DB_ERROR":
            return "database 'dropshy' MySQL me nahi hai";
        case "ER_ACCESS_DENIED_ERROR":
            return "MySQL user/password galat hai -> pool.js check karo";
        case "ECONNREFUSED":
            return "MySQL server band hai ya port galat hai";
        case "ER_DUP_ENTRY":
            return "duplicate entry: is page + banner number ka record pehle se hai";
        case "ER_DATA_TOO_LONG":
            return "image column chota hai -> image ko VARCHAR(255) rakho";
        case "ER_NO_DEFAULT_FOR_FIELD":
            return "table ke kisi required column ko value nahi mili (default nahi hai)";
        default:
            return "";
    }
};

const logSaved = (row) => {
    console.log("\n[SUCCESS] BANNER DB ME SAVE HO GAYA");
    console.log("   id            :", row.id);
    console.log("   page_name     :", row.page_name);
    console.log("   banner_number :", row.banner_number);
    console.log("   image         :", row.image);
    console.log("   status        :", row.status);
    console.log("");
};

const logNotSaved = (reason, extra = {}) => {
    console.error("\n[FAILED] BANNER DB ME SAVE NAHI HUA");
    console.error("   Wajah :", reason);
    Object.entries(extra).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            console.error(`   ${key} :`, value);
        }
    });
    console.error("");
};


// Server start hote hi DB + table check (terminal me turant pata chal jayega)
(async () => {
    try {
        await pool.query("SELECT 1 FROM banners LIMIT 1");
        console.log("[OK] MySQL connected aur 'banners' table mil gayi");
    } catch (error) {
        logNotSaved(
            explainDbError(error) || error.message,
            { code: error.code, sqlMessage: error.sqlMessage }
        );
    }
})();


// ======================================================
// MULTER
// ======================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 100000) +
            path.extname(file.originalname).toLowerCase();

        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG and WEBP images are allowed"), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Multer ke errors ko JSON me return karne ke liye
const uploadSingle = (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "Image 10MB se choti honi chahiye"
                    : err.message;

            logNotSaved(message, { source: "multer (file upload step)" });

            return res.status(400).json({
                success: false,
                message
            });
        }
        next();
    });
};

const deleteFile = (fileName) => {
    if (!fileName) return;

    const filePath = path.join(uploadDir, path.basename(fileName));

    fs.unlink(filePath, () => {});
};


// ======================================================
// 1. UPLOAD / UPDATE BANNER
//    Image folder me save hoti hai, uska FILENAME DB ke
//    `image` column me. Save ke baad DB se wapas padh ke
//    verify hota hai, aur terminal me SUCCESS / FAILED aata hai
// ======================================================

router.post("/upload", uploadSingle, async (req, res) => {
    try {
        const page_name = (req.body.page_name || "").trim();
        const banner_number = Number(req.body.banner_number);

        console.log("BANNER UPLOAD REQUEST:", {
            page_name,
            banner_number,
            file: req.file?.filename
        });

        if (!req.file) {
            logNotSaved("Image file request me aayi hi nahi (field ka naam 'image' hona chahiye)", {
                page_name,
                banner_number
            });

            return res.status(400).json({
                success: false,
                message: "Banner image is required"
            });
        }

        // Validation fail ho to upload hui file delete kar do
        const max = MAX_BANNERS[page_name];

        if (!max) {
            deleteFile(req.file.filename);
            logNotSaved(`Invalid page name: '${page_name}'`, {
                allowed: Object.keys(MAX_BANNERS).join(", ")
            });

            return res.status(400).json({
                success: false,
                message: `Invalid page name: ${page_name}`
            });
        }

        if (!Number.isInteger(banner_number) || banner_number < 1 || banner_number > max) {
            deleteFile(req.file.filename);
            logNotSaved(`Banner number galat hai: '${req.body.banner_number}'`, {
                page_name,
                allowed: `1 se ${max}`
            });

            return res.status(400).json({
                success: false,
                message: `${page_name} page ke liye banner number 1 se ${max} ke beech hona chahiye`
            });
        }

        const image = req.file.filename;

        // Is page + banner number ka purana record hai ya nahi
        const [existing] = await pool.query(
            `SELECT id, image FROM banners WHERE page_name = ? AND banner_number = ?`,
            [page_name, banner_number]
        );

        const isUpdate = existing.length > 0;

        if (isUpdate) {
            // ---------- UPDATE ----------
            await pool.query(
                `UPDATE banners
                 SET image = ?, status = 1
                 WHERE id = ?`,
                [image, existing[0].id]
            );
        } else {
            // ---------- INSERT ----------
            await pool.query(
                `INSERT INTO banners (page_name, banner_number, image, status)
                 VALUES (?, ?, ?, 1)`,
                [page_name, banner_number, image]
            );
        }

        // ---------- VERIFY: DB se wapas padh ke confirm karo ----------
        const [check] = await pool.query(
            `SELECT * FROM banners WHERE page_name = ? AND banner_number = ?`,
            [page_name, banner_number]
        );

        if (check.length === 0 || check[0].image !== image) {
            throw new Error(
                "Query chali par row DB me nahi mili ya image naam match nahi hua (verify fail)"
            );
        }

        // DB me save confirm hone ke BAAD hi purani image folder se hatao
        if (isUpdate) deleteFile(existing[0].image);

        logSaved(check[0]);

        return res.json({
            success: true,
            message: "Banner submitted successfully - database me save ho gaya",
            image,
            data: check[0]
        });

    } catch (error) {
        const hint = explainDbError(error);

        logNotSaved(hint || error.message, {
            code: error.code,
            sqlMessage: error.sqlMessage
        });
        console.error(error); // poora error stack

        // DB error aaye to file bhi hata do
        if (req.file) deleteFile(req.file.filename);

        return res.status(500).json({
            success: false,
            message: `Banner DB me save nahi hua: ${hint || error.message}`,
            code: error.code || null,
            sqlMessage: error.sqlMessage || null
        });
    }
});


// ======================================================
// 2. GET ALL BANNERS  (admin panel)
//    NOTE: ye route "/:page_name" se PEHLE hona chahiye
// ======================================================

router.get("/all", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM banners ORDER BY page_name, banner_number`
        );

        console.log(`[BANNER] GET /all -> ${rows.length} banner(s) DB se mile`);

        return res.json({ success: true, data: rows });

    } catch (error) {
        logNotSaved(explainDbError(error) || error.message, {
            step: "GET /all (banners padhte waqt)",
            code: error.code,
            sqlMessage: error.sqlMessage
        });

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ======================================================
// DEBUG: backend KIS database/table me likh raha hai
// URL: GET /api/banners/debug/db   (kaam ho jane par hata sakte ho)
// ======================================================

router.get("/debug/db", async (req, res) => {
    try {
        const [infoRows] = await pool.query(
            `SELECT DATABASE() AS db_name, @@hostname AS host, @@port AS port`
        );
        const [columns] = await pool.query(`SHOW COLUMNS FROM banners`);
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM banners`);
        const [latest] = await pool.query(
            `SELECT * FROM banners ORDER BY id DESC LIMIT 20`
        );

        const result = {
            success: true,
            database: infoRows[0].db_name,
            host: infoRows[0].host,
            port: infoRows[0].port,
            total_rows: countRows[0].total,
            columns: columns.map((c) => c.Field),
            latest_rows: latest
        };

        console.log("[DEBUG] /debug/db ->", {
            database: result.database,
            total_rows: result.total_rows
        });

        return res.json(result);

    } catch (error) {
        logNotSaved(explainDbError(error) || error.message, {
            step: "GET /debug/db",
            code: error.code,
            sqlMessage: error.sqlMessage
        });

        return res.status(500).json({
            success: false,
            message: error.message,
            code: error.code || null,
            sqlMessage: error.sqlMessage || null
        });
    }
});


// ======================================================
// 3. GET BANNERS OF ONE PAGE  (website)
// ======================================================

router.get("/:page_name", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM banners
             WHERE page_name = ? AND status = 1
             ORDER BY banner_number`,
            [req.params.page_name]
        );

        return res.json({ success: true, data: rows });

    } catch (error) {
        logNotSaved(explainDbError(error) || error.message, {
            step: `GET /${req.params.page_name}`,
            code: error.code,
            sqlMessage: error.sqlMessage
        });

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


module.exports = router;