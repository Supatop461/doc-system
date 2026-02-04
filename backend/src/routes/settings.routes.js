// src/routes/settings.routes.js
import { Router } from "express";
import { authRequired, requireAdmin } from "../middlewares/auth.js";

import {
  listDocumentTypes,
  createDocumentType,
  listItJobTypes,
  createItJobType,
} from "../controllers/settings.controller.js";

const router = Router();

/**
 * GET /api/document-types
 * optional: ?include_inactive=1
 */
router.get("/document-types", authRequired, listDocumentTypes);

/**
 * POST /api/document-types
 * admin only
 * body: { name, is_active? }
 */
router.post("/document-types", authRequired, requireAdmin, createDocumentType);

/**
 * GET /api/it-job-types
 * optional: ?include_inactive=1
 */
router.get("/it-job-types", authRequired, listItJobTypes);

/**
 * POST /api/it-job-types
 * admin only
 * body: { name, is_active? }
 */
router.post("/it-job-types", authRequired, requireAdmin, createItJobType);

export default router;
