const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            status: false,
            message: "Authorization token is required"
        });
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : authHeader;

    try {

        const decoded = jwt.verify(
            token,
            "DROPSHY_ADMIN_SECRET_2026"
        );

        req.admin = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            status: false,
            message: "Invalid or expired token"
        });

    }
}

module.exports = verifyToken;