import jwt from "jsonwebtoken";

/**
 * สร้าง JWT token
 * @param {Object} payload - ข้อมูล user เช่น { id, role }
 * @param {Object} options - option เพิ่มเติมของ jwt
 */
export const signToken = (payload, options = {}) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    ...options,
  });
};

/**
 * ตรวจสอบ JWT token
 * @param {string} token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
