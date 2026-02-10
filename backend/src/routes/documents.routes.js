// src/routes/documents.routes.js
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import pool from "../db/pool.js";

import {
  listDocuments,
  getDocument,
  downloadDocument,
  previewDocument,
  renameDocument,

  // ✅ TOP direct
  downloadTopFile,
  previewTopFile,
  deleteTopFile,
} from "../controllers/documents.controller.js";

import {
  uploadSingleFile,
  uploadDocument,
} from "../controllers/documents.upload.controller.js";

const router = Router();

// =========================
// Helpers
// =========================
function isValidId(id) {
  if (!id) return false;

  // integer id
  if (/^\d+$/.test(id)) return true;

  // uuid v4-ish (รองรับ uuid มาตรฐาน)
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return true;
  }

  // id เป็น string ยาวๆ (เช่น nanoid/ulid)
  if (/^[0-9a-zA-Z_-]{10,}$/.test(id)) return true;

  return false;
}

function requireMultipart(req, res, next) {
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("multipart/form-data")) {
    return res.status(415).json({
      ok: false,
      message: "Content-Type ต้องเป็น multipart/form-data",
    });
  }
  return next();
}

function validateIdParam(req, res, next) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ ok: false, message: "INVALID_ID" });
  }
  return next();
}

function getNumericUserId(req) {
  const userIdRaw =
    req.user?.user_id ??
    req.user?.id ??
    req.user?.userId ??
    req.user?.created_by_user_id;

  const n = Number(userIdRaw);
  return Number.isFinite(n) ? n : null;
}

// =========================
// Routes
// =========================

// --- Upload (รองรับทั้ง POST / และ POST /upload) ---
router.post(
  "/upload",
  authRequired,
  requireMultipart,
  uploadSingleFile,
  uploadDocument
);

router.post(
  "/",
  authRequired,
  requireMultipart,
  uploadSingleFile,
  uploadDocument
);

// ✅ TOP direct routes (สำหรับไฟล์ที่อยู่ใน C:\xampp\htdocs\top แต่ไม่มี DB)
// ต้องมาก่อน /:id
router.get("/top/:name/download", authRequired, downloadTopFile);
router.get("/top/:name/preview", authRequired, previewTopFile);
router.delete("/top/:name", authRequired, deleteTopFile);

// --- List documents (รวม DB + TOP) ---
router.get("/", authRequired, listDocuments);

/**
 * ✅ PATCH /api/documents/:id
 * แก้ชื่อเอกสาร (title)
 * body: { title: "..." }
 */
router.patch("/:id", authRequired, validateIdParam, (req, res, next) => {
  return renameDocument(req, res, next);
});

/**
 * ✅ DELETE /api/documents/:id
 * ย้ายเข้า "ถังขยะ" (soft delete)
 */
router.delete("/:id", authRequired, validateIdParam, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBy = getNumericUserId(req);
    if (deletedBy === null) {
      return res.status(400).json({
        ok: false,
        message: "INVALID_USER_ID_FOR_DELETE",
      });
    }

    const { rowCount } = await pool.query(
      `
      UPDATE documents
      SET deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE document_id = $1
        AND deleted_at IS NULL
      `,
      [id, deletedBy]
    );

    if (!rowCount) {
      return res
        .status(404)
        .json({ ok: false, message: "NOT_FOUND_OR_ALREADY_DELETED" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("DOCUMENT DELETE error:", err);
    return res.status(500).json({ ok: false, message: "DOCUMENT_DELETE_FAILED" });
  }
});

// --- Preview/Download ต้องมาก่อน GET /:id ---
router.get("/:id/preview", authRequired, validateIdParam, (req, res, next) => {
  return previewDocument(req, res, next);
});

router.get("/:id/download", authRequired, validateIdParam, (req, res, next) => {
  return downloadDocument(req, res, next);
});

// --- Get document detail ---
router.get("/:id", authRequired, validateIdParam, (req, res, next) => {
  return getDocument(req, res, next);
});

export default router;