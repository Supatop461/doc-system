// src/middlewares/auth.js
import { verifyToken } from "../utils/jwt.js";

export const authRequired = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({
        message: "ต้องส่ง Authorization: Bearer <token>",
      });
    }

    const payload = verifyToken(token);

    // ✅ normalize id
    const id = payload?.id ?? payload?.userId ?? payload?.user_id ?? null;
    if (!id) return res.status(401).json({ message: "Token ไม่มี user id" });

    // ✅ normalize role -> ให้เป็นมาตรฐานตัวเล็ก: admin / user
    const rawRole =
      payload?.role ?? payload?.userRole ?? payload?.user_role ?? null;

    const role = rawRole ? String(rawRole).toLowerCase() : null;

    req.user = {
      ...payload,
      id,
      role,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
};

export const requireAdmin = (req, res, next) => {
  // ต้องผ่าน authRequired มาก่อน
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "ต้องเป็น admin เท่านั้น" });
  }
  return next();
};
