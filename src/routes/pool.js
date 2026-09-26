var mysql = require("mysql2/promise");

var pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 3306,

    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "1234",

    database: process.env.DB_NAME || "dropshy",

    multipleStatements: true,
    connectionLimit: 100
});

module.exports = pool;