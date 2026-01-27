import bcrypt from "bcrypt";
import pool from "../db/pool.js";
import { signToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "username and password are required" });
    }

    const { rows } = await pool.query(
      `SELECT user_id, username, password_hash, role, is_active
       FROM public.users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    const user = rows?.[0];
    if (!user) return res.status(401).json({ message: "User not found" });
    if (!user.is_active)
      return res.status(403).json({ message: "Account disabled" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Wrong password" });

    const normalizedRole = user.role ? String(user.role).toUpperCase() : null;

    const token = signToken({
      id: user.user_id, // ✅ มาตรฐานเดียวกับ auth.middleware
      username: user.username,
      role: normalizedRole, // ✅ ADMIN | USER
    });

    return res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        role: normalizedRole,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
