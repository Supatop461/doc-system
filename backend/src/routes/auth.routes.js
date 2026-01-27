import express from "express";
import { login } from "../controllers/auth.controller.js";

const router = express.Router();

/**
 * POST /api/auth/login
 * body: { username, password }
 */
router.post("/login", login);

export default router;
