// backend/src/routes/users.routes.js
import { Router } from "express";
import { authRequired, requireAdmin } from "../middlewares/auth.js";
import { listUsers, setUserActive } from "../controllers/users.controller.js";

const router = Router();

router.get("/", authRequired, requireAdmin, listUsers);
router.patch("/:id/active", authRequired, requireAdmin, setUserActive);

export default router;
