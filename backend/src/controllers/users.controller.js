// backend/src/controllers/users.controller.js
import pool from "../db/pool.js";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

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

export const createUser = async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "").trim();

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "ต้องกรอกรหัสพนักงาน (username) และรหัสผ่าน (password)",
      });
    }

    // กันแปลก ๆ / UI กรอกยาวเกิน
    if (username.length < 2 || username.length > 50) {
      return res.status(400).json({ ok: false, message: "รหัสพนักงานต้องยาว 2-50 ตัวอักษร" });
    }
    if (password.length < 4 || password.length > 100) {
      return res.status(400).json({ ok: false, message: "รหัสผ่านต้องยาว 4-100 ตัวอักษร" });
    }

    // เช็คซ้ำ
    const dup = await pool.query(
      `SELECT 1 FROM public.users WHERE username = $1 LIMIT 1`,
      [username]
    );
    if (dup.rows?.length) {
      return res.status(409).json({ ok: false, message: "มีรหัสพนักงานนี้อยู่แล้ว" });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // role เป็น USER-DEFINED (น่าจะ enum) — ใช้ค่า USER ให้เข้ากับระบบเดิม (login จะ normalize เป็น USER)
    const sql = `
      INSERT INTO public.users (username, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, 'USER', TRUE, NOW(), NOW())
      RETURNING user_id, username, role, is_active, created_at, updated_at
    `;

    const { rows } = await pool.query(sql, [username, password_hash]);
    return res.status(201).json({ ok: true, item: rows?.[0] });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);

    // เผื่อมี unique constraint
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, message: "มีรหัสพนักงานนี้อยู่แล้ว" });
    }

    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
};

export const setUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body || {};

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ ok: false, message: "is_active ต้องเป็น boolean" });
    }

    // กันแอดมินปิดตัวเอง
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