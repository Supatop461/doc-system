// src/controllers/documents.upload.controller.js
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db/pool.js";
import { createDocument } from "../services/documents.service.js";

// ========== config ==========
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
]);

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {}
}

function toInt(value) {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

// ========== multer config ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname);
    const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${safeBase}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error("File type not allowed");
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

export const uploadSingleFile = uploader.single("file");

export async function uploadDocument(req, res) {
  try {
    // ========= 1) validate file =========
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "file is required (field name: file)",
      });
    }

    // ========= 2) parse body =========
    const folder_id = toInt(req.body?.folder_id);
    const document_type_id = toInt(req.body?.document_type_id);
    const it_job_type_id = toInt(req.body?.it_job_type_id);

    // ✅ มาตรฐานใหม่: req.user.id
    const created_by = req.user?.id ?? null;

    // ========= 3) validate required =========
    if (!folder_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message: "folder_id is required and must be integer",
      });
    }

    if (!document_type_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message: "document_type_id is required and must be integer",
      });
    }

    if (!it_job_type_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message: "it_job_type_id is required and must be integer",
      });
    }

    if (!created_by) {
      safeUnlink(req.file?.path);
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }

    // ========= 4) validate FK exists =========
    // folder exists
    const checkFolder = await pool.query(
      "SELECT folder_id FROM folders WHERE folder_id = $1 AND deleted_at IS NULL LIMIT 1",
      [folder_id]
    );
    if (checkFolder.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res.status(404).json({ ok: false, message: "folder not found" });
    }

    // document type exists
    const checkDocType = await pool.query(
      "SELECT document_type_id FROM document_types WHERE document_type_id = $1 AND deleted_at IS NULL LIMIT 1",
      [document_type_id]
    );
    if (checkDocType.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res
        .status(404)
        .json({ ok: false, message: "document type not found" });
    }

    // it job type exists
    const checkJobType = await pool.query(
      "SELECT it_job_type_id FROM it_job_types WHERE it_job_type_id = $1 AND deleted_at IS NULL LIMIT 1",
      [it_job_type_id]
    );
    if (checkJobType.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res
        .status(404)
        .json({ ok: false, message: "it job type not found" });
    }

    // ========= 5) create document =========
    const doc = await createDocument({
      original_file_name: req.file.originalname,
      stored_file_name: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      folder_id,
      document_type_id,
      it_job_type_id,
      created_by,
    });

    return res.status(201).json({ ok: true, document: doc });
  } catch (err) {
    if (err?.code === "LIMIT_FILE_SIZE") {
      safeUnlink(req.file?.path);
      return res.status(413).json({ ok: false, message: "File too large" });
    }

    if (err?.status === 415) {
      safeUnlink(req.file?.path);
      return res.status(415).json({ ok: false, message: err.message });
    }

    console.error("uploadDocument error:", err);
    safeUnlink(req.file?.path);
    return res.status(500).json({
      ok: false,
      message: "Internal server error",
      error: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
  }
}
