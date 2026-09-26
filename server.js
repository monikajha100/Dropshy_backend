require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Har request terminal me dikhao
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------- ROUTES ----------------
app.use("/api/banners", require("./src/routes/banner"));

// Blog routes (file ke andar "/blogs/..." likha hai, isliye yaha sirf "/api")
const blogRoutes = require("./src/routes/blog");
app.use("/api", blogRoutes);

const userRoutes = require("./src/routes/users");

app.use("/api", userRoutes);
const adminRoutes = require("./src/routes/admin");
app.use("/admin", adminRoutes);
const sellerRoutes = require("./src/routes/sellors");
app.use("/api/sellers", sellerRoutes);
// 404 handler (sabse neeche)
app.use((req, res) => {
    console.error(`[404] Route nahi mila: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dropshy Backend running on port ${PORT}`);
});