
var express = require("express");
var router = express.Router();

var jwt = require("jsonwebtoken");
var pool = require("./pool");

// ==========================================
// ADMIN LOGIN
// POST /admin/chk_admin_login
// ==========================================
router.post("/chk_admin_login", async function (req, res) {

    console.log("========================================");
    console.log("ADMIN LOGIN REQUEST");
    console.log("Admin Login Body:", req.body);

    try {

        var { id, password } = req.body;

        // ==========================================
        // REQUIRED FIELD CHECK
        // ==========================================
        if (!id || !password) {

            console.log("LOGIN FAILED: Missing ID or Password");

            return res.status(200).json({
                data: [],
                message: "Email/Mobile and Password are required",
                status: false
            });
        }

        // ==========================================
        // ADMIN LOGIN QUERY
        // ==========================================
        var sql = `
            SELECT *
            FROM dropshy_admin
            WHERE (email = ? OR mobile = ?)
            AND password = ?
            AND status = 1
        `;

        console.log("ADMIN LOGIN QUERY STARTED");
        console.log("Login ID:", id);

        pool.query(
            sql,
            [id, id, password],
            function (error, result) {

                // ==========================================
                // DATABASE ERROR
                // ==========================================
                console.log("ADMIN QUERY ERROR:", error);
                console.log("ADMIN QUERY RESULT:", result);

                if (error) {

                    console.log("DATABASE ERROR OCCURRED");

                    return res.status(500).json({
                        data: [],
                        message: "Database error",
                        status: false
                    });
                }

                // ==========================================
                // ADMIN FOUND
                // ==========================================
                if (result && result.length === 1) {

                    console.log("ADMIN FOUND IN DATABASE");

                    var adminRow = result[0];

                    // Password response me nahi bhejna
                    var data = { ...adminRow };
                    delete data.password;

                    // ==========================================
                    // CREATE JWT TOKEN
                    // ==========================================
                    var token = jwt.sign(
                        {
                            id: data.id,
                            email: data.email,
                            role: "admin"
                        },
                        "DROPSHY_ADMIN_SECRET_2026",
                        {
                            expiresIn: "1d"
                        }
                    );

                    console.log("ADMIN LOGIN SUCCESS");
                    console.log("ADMIN DATA:", data);
                    console.log("TOKEN CREATED:", !!token);

                    return res.status(200).json({
                        data: data,
                        token: token,
                        message: "Login Successful",
                        status: true
                    });

                }

                // ==========================================
                // ADMIN NOT FOUND
                // ==========================================
                else {

                    console.log(
                        "ADMIN LOGIN FAILED: No matching admin found"
                    );

                    console.log(
                        "Check email/mobile, password and status=1"
                    );

                    return res.status(200).json({
                        data: [],
                        message: "Invalid Admin ID / Password",
                        status: false
                    });
                }
            }
        );

    } catch (e) {

        console.log("CRITICAL ERROR:", e);

        return res.status(500).json({
            data: [],
            message: "Critical server error",
            status: false
        });
    }
});

module.exports = router;

