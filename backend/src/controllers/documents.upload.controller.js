// src/controllers/documents.upload.controller.js
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db/pool.js";
import { createDocument } from "../services/documents.service.js";

// ========== config ==========
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// whitelist mime types (เพิ่ม/ลดได้ตามต้องการ)
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

// สร้าง uploads แบบชัวร์ ๆ จาก root runtime
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// helper: ลบไฟล์ถ้ามี
function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {}
}

// helper: parse int
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
    // เอาแต่ชื่อไฟล์ ไม่เอา path
    const base = path.basename(file.originalname);

    // จำกัดชื่อไฟล์ให้ปลอดภัย
    const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_");

    // ใส่ unique prefix
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
    const folder_id = toInt(req.body?.folder_id);

    if (!folder_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message: "folder_id is required and must be integer",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "file is required (field name: file)",
      });
    }

    // ✅ เช็ค folder มีจริง (และยังไม่ถูกลบ)
    const check = await pool.query(
      "SELECT folder_id FROM folders WHERE folder_id = $1 AND deleted_at IS NULL LIMIT 1",
      [folder_id]
    );
    if (check.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res.status(404).json({ ok: false, message: "folder not found" });
    }

    // ✅ มาตรฐานใหม่: req.user.id
    const created_by = req.user?.id ?? null;

    const doc = await createDocument({
      original_file_name: req.file.originalname,
      stored_file_name: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      folder_id,
      created_by,
    });

    return res.status(201).json({ ok: true, document: doc });
  } catch (err) {
    // multer file size
    if (err?.code === "LIMIT_FILE_SIZE") {
      safeUnlink(req.file?.path);
      return res.status(413).json({ ok: false, message: "File too large" });
    }

    // fileFilter error
    if (err?.status === 415) {
      safeUnlink(req.file?.path);
      return res.status(415).json({ ok: false, message: err.message });
    }

    console.error("uploadDocument error:", err);
    safeUnlink(req.file?.path);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
}
