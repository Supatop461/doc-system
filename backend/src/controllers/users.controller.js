// backend/src/controllers/users.controller.js
import pool from "../db/pool.js";

export const listUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const params = [];
    let where = "1=1";

    if (q) {
      params.push(`%${q}%`);
      where = `(username ILIKE $${params.length} OR role::text ILIKE $${params.length})`;
    }

    const sql = `
      SELECT user_id, username, role, is_active, created_at, updated_at
      FROM public.users
      WHERE ${where}
      ORDER BY user_id ASC
      LIMIT 500
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, items: rows });
  } catch (err) {
    console.error("LIST USERS ERROR:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

export const setUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body || {};

    if (typeof is_active !== "boolean") {
      return res
        .status(400)
        .json({ ok: false, message: "is_active ต้องเป็น boolean" });
    }
    if (Number(req.user.id) === Number(id)) {
  return res.status(400).json({
    ok: false,
    message: "ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้",
     });
    }
    const sql = `
      UPDATE public.users
      SET is_active = $1,
          updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, username, role, is_active, created_at, updated_at
    `;

    const { rows } = await pool.query(sql, [is_active, id]);
    const user = rows?.[0];
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    return res.json({ ok: true, item: user });
  } catch (err) {
    console.error("SET ACTIVE ERROR:", err);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};
