// routes/documents.routes.js
import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

import {
  listDocuments,
  getDocument,
  downloadDocument,
  listTrash,
  deleteDocument,
  restoreDocument,
} from "../controllers/documents.controller.js";

import {
  uploadSingleFile,
  uploadDocument,
} from "../controllers/documents.upload.controller.js";

const router = Router();

/**
 * STEP 9:
 * GET /api/documents?folder_id=...
 * user+admin
 */
router.get("/", authMiddleware, listDocuments);

/**
 * STEP 10:
 * GET /api/documents/trash
 * ✅ ล็อก: ADMIN เท่านั้น
 */
router.get("/trash", authMiddleware, requireRole("ADMIN"), listTrash);

/**
 * STEP 9:
 * GET /api/documents/:id/download
 * user+admin
 */
router.get("/:id/download", authMiddleware, downloadDocument);

/**
 * (optional) ดูรายละเอียดเอกสาร
 * user+admin
 */
router.get("/:id", authMiddleware, getDocument);

/**
 * STEP 9:
 * POST /api/documents  (Upload file จริง + insert DB)
 * user+admin
 */
router.post("/", authMiddleware, uploadSingleFile, uploadDocument);

/**
 * ✅ backward compatible (ยังให้ใช้ได้)
 * POST /api/documents/upload
 */
router.post("/upload", authMiddleware, uploadSingleFile, uploadDocument);

/**
 * soft delete / restore
 * ✅ delete: ADMIN เท่านั้น (ของเดิมถูกแล้ว)
 * ✅ restore: ADMIN เท่านั้น (เพิ่มล็อก)
 */
router.delete("/:id", authMiddleware, requireRole("ADMIN"), deleteDocument);
router.patch("/:id/restore", authMiddleware, requireRole("ADMIN"), restoreDocument);

export default router;
