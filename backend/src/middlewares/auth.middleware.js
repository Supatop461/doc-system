import { verifyToken } from "../utils/jwt.js";

export const authMiddleware = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyToken(token);

    // ✅ normalize id (รองรับของเก่าหลายรูปแบบ)
    const normalizedId =
      payload?.id ??
      payload?.userId ??
      payload?.user_id ??
      null;

    // ✅ normalize role (รองรับของเก่า + บังคับรูปแบบเดียว)
    const normalizedRole =
      payload?.role ??
      payload?.userRole ??
      payload?.user_role ??
      null;

    if (!normalizedId) {
      return res
        .status(401)
        .json({ message: "Unauthorized (missing user id in token)" });
    }

    req.user = {
      ...payload,
      id: normalizedId,
      role: normalizedRole
        ? String(normalizedRole).toUpperCase()
        : null,
    };

    next();
  } catch (err) {
    return res
      .status(403)
      .json({ message: "Invalid or expired token" });
  }
};
