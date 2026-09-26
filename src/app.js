require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({
    message: "Dropshy Backend is running 🚀",
  });
});
var adminRouter = require("./router/admin");

app.use("/admin", adminRouter);



const blogRoutes = require("./blogRoutes"); // apni routes file ka sahi naam/path
app.use("/api", blogRoutes);
var bannerRoutes = require("./routes/banner");
app.use("/api/banners", bannerRoutes);
var sellorsRoutes = require("./routes/sellors");
app.use("/api/sellers", sellorsRoutes);
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Dropshy Backend running on http://localhost:${PORT}`);
});