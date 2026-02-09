// src/routes/auth.routes.js
import express from "express";
import { login } from "../controllers/auth.controller.js";

const router = express.Router();

/**
 * POST /api/auth/login
 * body: { username, password }
 */
router.post("/login", login);

// GET /api/auth/me
import { authRequired } from "../middlewares/auth.js";

router.get("/me", authRequired, (req, res) => {
  res.json({
    user_id: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });
});

export default router;
