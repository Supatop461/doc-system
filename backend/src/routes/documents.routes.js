// src/routes/documents.routes.js
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";

import {
  listDocuments,
  getDocument,
  downloadDocument,
} from "../controllers/documents.controller.js";

import {
  uploadSingleFile,
  uploadDocument,
} from "../controllers/documents.upload.controller.js";

const router = Router();

// helper: validate id (รองรับเลขและ uuid-ish)
function isValidId(id) {
  if (!id) return false;
  if (/^\d+$/.test(id)) return true;            // integer id
  if (/^[0-9a-fA-F-]{10,}$/.test(id)) return true; // uuid-ish
  return false;
}

// helper: enforce multipart on upload routes (กันส่ง json แล้ว multer งง)
function requireMultipart(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (!ct.includes("multipart/form-data")) {
    return res.status(415).json({
      ok: false,
      message: "Content-Type must be multipart/form-data",
    });
  }
  next();
}

/**
 * ✅ backward compatible
 * POST /api/documents/upload
 * (ต้องอยู่ก่อน /:id)
 */
router.post(
  "/upload",
  authRequired,
  requireMultipart,
  uploadSingleFile,
  uploadDocument
);

/**
 * STEP 9:
 * GET /api/documents?folder_id=...
 * user + admin
 */
router.get("/", authRequired, listDocuments);

/**
 * STEP 9:
 * POST /api/documents (Upload file จริง + insert DB)
 * user + admin
 */
router.post(
  "/",
  authRequired,
  requireMultipart,
  uploadSingleFile,
  uploadDocument
);

/**
 * STEP 9:
 * GET /api/documents/:id/download
 * user + admin
 */
router.get("/:id/download", authRequired, (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ ok: false, message: "INVALID_ID" });
  }
  return downloadDocument(req, res, next);
});

/**
 * (optional) ดูรายละเอียดเอกสาร
 * user + admin
 */
router.get("/:id", authRequired, (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ ok: false, message: "INVALID_ID" });
  }
  return getDocument(req, res, next);
});

export default router;
