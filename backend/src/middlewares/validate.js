import { HttpError } from "../utils/httpError.js";

export function requireBody(fields = []) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => req.body?.[f] == null || req.body?.[f] === "");
    if (missing.length) {
      return next(new HttpError(400, `Missing fields: ${missing.join(", ")}`, {
        code: "VALIDATION_ERROR",
        publicMessage: "ข้อมูลไม่ครบ",
      }));
    }
    next();
  };
}
