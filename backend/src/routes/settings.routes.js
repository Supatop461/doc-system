// src/routes/settings.routes.js
import { Router } from "express";
import { authRequired, requireAdmin } from "../middlewares/auth.js";

import {
  listDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  listItJobTypes,
  createItJobType,
  updateItJobType,
  deleteItJobType,
} from "../controllers/settings.controller.js";

const router = Router();

// Document Types
router.get("/document-types", authRequired, listDocumentTypes);
router.post("/document-types", authRequired, requireAdmin, createDocumentType);

// ✅ รองรับทั้ง PUT และ PATCH (กันหน้าเว็บยิง PUT)
router.put("/document-types/:id", authRequired, requireAdmin, updateDocumentType);
router.patch("/document-types/:id", authRequired, requireAdmin, updateDocumentType);

router.delete("/document-types/:id", authRequired, requireAdmin, deleteDocumentType);

// IT Job Types
router.get("/it-job-types", authRequired, listItJobTypes);
router.post("/it-job-types", authRequired, requireAdmin, createItJobType);

// ✅ รองรับทั้ง PUT และ PATCH
router.put("/it-job-types/:id", authRequired, requireAdmin, updateItJobType);
router.patch("/it-job-types/:id", authRequired, requireAdmin, updateItJobType);

router.delete("/it-job-types/:id", authRequired, requireAdmin, deleteItJobType);

export default router;