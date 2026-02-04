import express from "express";
import { getDashboardSummary } from "../controllers/dashboard.controller.js";

// ✅ แก้ path import ตรงนี้ให้ตรงของจริงในโปรเจกต์คุณ
// ตัวอย่างที่พบบ่อย:
// import authMiddleware from "../middlewares/auth.middleware.js";
// import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authRequired } from "../middlewares/auth.js";


const router = express.Router();

// GET /dashboard/summary
router.get("/summary", authRequired, getDashboardSummary);


export default router;
