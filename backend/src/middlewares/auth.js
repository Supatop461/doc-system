import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "ต้องส่ง Authorization: Bearer <token>" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ normalize id ให้ทุกไฟล์ใช้แบบเดียวกัน
    const id = payload?.id ?? payload?.userId ?? payload?.user_id ?? null;

    req.user = {
      ...payload,
      id, // ✅ ตอนนี้ทุกที่ใช้ req.user.id ได้เลย
    };

    if (!req.user.id) {
      return res.status(401).json({ message: "Token ไม่มี user id" });
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "ต้องเป็น ADMIN เท่านั้น" });
  }
  return next();
}
