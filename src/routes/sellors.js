const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();
const pool = require("./pool");

// ======================================================
// GENERATE UNIQUE ENROLLMENT NUMBER
// ======================================================

function generateEnrollmentNumber() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();

  const uniqueCode = Math.floor(100 + Math.random() * 900);

  return `D-${dd}-${mm}-${yyyy}-${uniqueCode}`;
}

// ======================================================
// SELLER REGISTER
// POST /api/sellers/register
// ======================================================

router.post("/register", async (req, res) => {
  console.log("\n=================================");
  console.log("SELLER REGISTER API HIT");
  console.log("REQUEST BODY:");
  console.log(req.body);
  console.log("=================================\n");

  try {
    const {
      fullName,
      mobile,
      altMobile,
      email,
      whatsapp,
      address,
      city,
      state,
      pincode,
      password,
    } = req.body;

    // ==================================================
    // REQUIRED FIELDS
    // ==================================================

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Full name is required.",
      });
    }

    if (!mobile || !mobile.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Mobile number is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Email is required.",
      });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Address is required.",
      });
    }

    if (!city || !city.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "City is required.",
      });
    }

    if (!state || !state.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "State is required.",
      });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Password is required.",
      });
    }

    // ==================================================
    // CLEAN DATA
    // ==================================================

    const cleanFullName = fullName.trim();
    const cleanMobile = mobile.trim();
    const cleanAltMobile = altMobile
      ? altMobile.trim()
      : null;

    const cleanEmail = email.trim().toLowerCase();

    const cleanWhatsapp = whatsapp
      ? whatsapp.trim()
      : null;

    const cleanAddress = address.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim();

    const cleanPincode = pincode
      ? pincode.trim()
      : null;

    const cleanPassword = password.trim();

    // ==================================================
    // VALIDATION
    // ==================================================

    if (!/^\d{10}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Mobile number must be exactly 10 digits.",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Please enter a valid email address.",
      });
    }

    if (
      cleanPincode &&
      !/^\d{6}$/.test(cleanPincode)
    ) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "PIN code must be exactly 6 digits.",
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // ==================================================
    // CHECK EXISTING SELLER
    // ==================================================

    console.log("CHECKING EXISTING MOBILE / EMAIL...");

    const [existing] = await pool.query(
      `
      SELECT
        id,
        enrollmentNumber,
        mobile,
        email
      FROM sellers
      WHERE mobile = ?
         OR email = ?
      LIMIT 1
      `,
      [cleanMobile, cleanEmail]
    );

    if (existing.length > 0) {
      const seller = existing[0];

      if (seller.mobile === cleanMobile) {
        return res.status(409).json({
          success: false,
          status: false,
          message: "This mobile number is already registered.",
          enrollmentNumber: seller.enrollmentNumber,
        });
      }

      if (seller.email === cleanEmail) {
        return res.status(409).json({
          success: false,
          status: false,
          message: "This email address is already registered.",
          enrollmentNumber: seller.enrollmentNumber,
        });
      }
    }

    // ==================================================
    // GENERATE UNIQUE ENROLLMENT NUMBER
    // ==================================================

    let enrollmentNumber;
    let exists = true;

    while (exists) {
      enrollmentNumber = generateEnrollmentNumber();

      const [check] = await pool.query(
        `
        SELECT id
        FROM sellers
        WHERE enrollmentNumber = ?
        LIMIT 1
        `,
        [enrollmentNumber]
      );

      exists = check.length > 0;
    }

    console.log(
      "GENERATED ENROLLMENT:",
      enrollmentNumber
    );

    // ==================================================
    // HASH PASSWORD
    // ==================================================

    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      10
    );

    console.log("PASSWORD HASHED SUCCESSFULLY");

    // ==================================================
    // INSERT DATA INTO DATABASE
    // ==================================================

    console.log("INSERTING SELLER INTO DATABASE...");

    const [result] = await pool.query(
      `
      INSERT INTO sellers
      (
        enrollmentNumber,
        fullName,
        mobile,
        altMobile,
        email,
        whatsapp,
        address,
        city,
        state,
        pincode,
        password
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        enrollmentNumber,
        cleanFullName,
        cleanMobile,
        cleanAltMobile,
        cleanEmail,
        cleanWhatsapp,
        cleanAddress,
        cleanCity,
        cleanState,
        cleanPincode,
        hashedPassword,
      ]
    );

    console.log(
      "SELLER INSERT SUCCESSFUL"
    );

    console.log(
      "INSERT ID:",
      result.insertId
    );

    console.log(
      "ENROLLMENT:",
      enrollmentNumber
    );

    // ==================================================
    // VERIFY INSERT
    // ==================================================

    const [savedSeller] = await pool.query(
      `
      SELECT
        id,
        enrollmentNumber,
        fullName,
        mobile,
        altMobile,
        email,
        whatsapp,
        address,
        city,
        state,
        pincode,
        created_at,
        updated_at
      FROM sellers
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    console.log(
      "DATABASE SAVED DATA:"
    );

    console.log(
      savedSeller[0]
    );

    // ==================================================
    // SUCCESS RESPONSE
    // ==================================================

    return res.status(201).json({
      success: true,
      status: true,
      message: "Seller registration successful.",
      sellerId: result.insertId,
      enrollmentNumber: enrollmentNumber,
      seller: savedSeller[0],
    });

  } catch (error) {

    console.error(
      "\nSELLER REGISTER DATABASE ERROR:"
    );

    console.error(error);

    return res.status(500).json({
      success: false,
      status: false,
      message: "Server error while registering seller.",
      error: error.message,
    });
  }
});

// ======================================================
// SELLER LOGIN
// POST /api/sellers/login
// ======================================================

router.post("/login", async (req, res) => {
  try {

    const {
      identifier,
      password,
    } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        status: false,
        message: "Login ID and password are required.",
      });
    }

    const cleanIdentifier = identifier.trim();

    const [rows] = await pool.query(
      `
      SELECT
        id,
        enrollmentNumber,
        fullName,
        mobile,
        altMobile,
        email,
        whatsapp,
        address,
        city,
        state,
        pincode,
        password,
        created_at,
        updated_at
      FROM sellers
      WHERE enrollmentNumber = ?
         OR mobile = ?
         OR email = ?
      LIMIT 1
      `,
      [
        cleanIdentifier,
        cleanIdentifier,
        cleanIdentifier.toLowerCase(),
      ]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        status: false,
        message: "Invalid enrollment number, mobile/email or password.",
      });
    }

    const seller = rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      seller.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        status: false,
        message: "Invalid enrollment number, mobile/email or password.",
      });
    }

    delete seller.password;

    return res.status(200).json({
      success: true,
      status: true,
      message: "Seller login successful.",
      seller: seller,
    });

  } catch (error) {

    console.error(
      "SELLER LOGIN API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      status: false,
      message: "Server error while logging in seller.",
      error: error.message,
    });
  }
});
router.get("/all", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        enrollmentNumber,
        fullName,
        mobile,
        altMobile,
        email,
        whatsapp,
        address,
        city,
        state,
        pincode,
        created_at,
        updated_at
      FROM sellers
      ORDER BY id DESC
    `);

    return res.status(200).json({
      success: true,
      status: true,
      message: "Sellers fetched successfully.",
      count: rows.length,
      sellers: rows,
    });

  } catch (error) {
    console.error("FETCH SELLERS ERROR:", error);

    return res.status(500).json({
      success: false,
      status: false,
      message: "Server error while fetching sellers.",
      error: error.message,
    });
  }
});
module.exports = router;