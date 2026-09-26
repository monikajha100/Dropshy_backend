const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./pool");

const router = express.Router();
console.log("===== USERS.JS LOADED =====");
// ===============================
// REGISTER USER
// ===============================
router.post("/users/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        status: false,
        message: "Name, email and password are required",
      });
    }

    // Check existing email
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        status: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      `INSERT INTO users 
       (name, email, phone, password)
       VALUES (?, ?, ?, ?)`,
      [name, email, phone || null, hashedPassword]
    );

    return res.status(201).json({
      status: true,
      message: "Account created successfully",
      userId: result.insertId,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
});


// ===============================
// LOGIN USER
// ===============================
router.post("/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password are required",
      });
    }

    // Find user
    const [users] = await pool.query(
      `SELECT id, name, email, phone, password
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        status: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    // Check password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        status: false,
        message: "Invalid email or password",
      });
    }

    // JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET || "dropshy_secret_key",
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      status: true,
      message: "Login successful",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ===============================
// GET ALL USERS FOR ADMIN DASHBOARD
// ===============================
router.get("/users/all", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        email,
        phone,
        created_at,
        updated_at
      FROM users
      ORDER BY id DESC
    `);

    return res.status(200).json({
      success: true,
      status: true,
      message: "Users fetched successfully.",
      count: rows.length,
      users: rows
    });

  } catch (error) {
    console.error("FETCH USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      status: false,
      message: "Server error while fetching users.",
      error: error.message
    });
  }
});


module.exports = router;