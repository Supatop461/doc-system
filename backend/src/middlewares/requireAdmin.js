// src/middlewares/requireAdmin.js
import pool from "../db/pool.js";

export async function requireAdmin(req, res, next) {
  try {
    // authMiddleware ต้องมาก่อน
    if (!req.user || !req.userId) {
      return res.status(401).json({ message: "UNAUTHORIZED" });
    }

    const userId = req.userId;

    // 🔑 เช็คจาก DB ตรง ๆ ตาม schema ของคุณ
    const { rows } = await pool.query(
      `
      SELECT role, is_active
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "UNAUTHORIZED" });
    }

    const user = rows[0];

    // ❌ user ถูกปิดใช้งาน
    if (user.is_active !== true) {
      return res.status(403).json({ message: "USER_DISABLED" });
    }

    // ✅ admin = role === 'ADMIN'
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "FORBIDDEN_ADMIN_ONLY" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ message: "ADMIN_CHECK_FAILED" });
  }
}
