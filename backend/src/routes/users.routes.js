// backend/src/routes/users.routes.js
import { Router } from "express";
import { authRequired, requireAdmin } from "../middlewares/auth.js";
import { listUsers, setUserActive, createUser } from "../controllers/users.controller.js";

const router = Router();

// list
router.get("/", authRequired, requireAdmin, listUsers);

// ✅ create user (admin only) : { username, password }
router.post("/", authRequired, requireAdmin, createUser);

// active toggle
router.patch("/:id/active", authRequired, requireAdmin, setUserActive);

export default router;