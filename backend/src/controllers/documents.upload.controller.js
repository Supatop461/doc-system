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

// ✅ เก็บไฟล์ต้นทางแบบเดิม (ไม่พังของเก่า)
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ ปลายทาง public สำหรับ Apache/XAMPP
const XAMPP_PUBLIC_DIR = "C:/xampp/htdocs/top";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

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

/**
 * ✅ แก้ปัญหาชื่อไฟล์ไทยเพี้ยนเป็น à¸...
 * บางเครื่อง multer/busboy ส่ง originalname เป็น latin1 ทั้งที่จริงเป็น utf8 bytes
 */
function fixOriginalName(name = "") {
  try {
    const restored = Buffer.from(String(name), "latin1").toString("utf8");
    const bad = (restored.match(/�/g) || []).length;
    if (bad > 0) return String(name);
    return restored;
  } catch {
    return String(name);
  }
}

function copyToXampp(storedFileName, srcAbsPath) {
  ensureDir(XAMPP_PUBLIC_DIR);
  const destAbsPath = path.join(XAMPP_PUBLIC_DIR, storedFileName);
  fs.copyFileSync(srcAbsPath, destAbsPath); // ✅ copy (ไม่พังของเดิม)
  return destAbsPath;
}

// ========== multer config ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const fixed = fixOriginalName(file.originalname);
    const base = path.basename(fixed);

    // ชื่อไฟล์ที่ "เก็บจริง" ขอให้เป็น safe ascii (กันปัญหา path/OS)
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

    const body_document_type_id =
      toInt(req.body?.document_type_id) ?? toInt(req.body?.doc_type_id);
    const body_it_job_type_id =
      toInt(req.body?.it_job_type_id) ?? toInt(req.body?.it_work_id);

    const created_by = req.user?.id ?? null;

    // ========= 3) validate required =========
    if (!folder_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message: "folder_id is required and must be integer",
      });
    }

    if (!created_by) {
      safeUnlink(req.file?.path);
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }

    // ========= 4) get folder meta (source of truth) =========
    const folderRes = await pool.query(
      `SELECT folder_id, document_type_id, it_job_type_id
       FROM folders
       WHERE folder_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [folder_id]
    );

    if (folderRes.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res.status(404).json({ ok: false, message: "folder not found" });
    }

    const folder = folderRes.rows[0];

    const document_type_id =
      body_document_type_id ?? toInt(folder?.document_type_id);
    const it_job_type_id = body_it_job_type_id ?? toInt(folder?.it_job_type_id);

    if (!document_type_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message:
          "document_type_id is missing. Please set document type on the folder first.",
      });
    }

    if (!it_job_type_id) {
      safeUnlink(req.file?.path);
      return res.status(400).json({
        ok: false,
        message:
          "it_job_type_id is missing. Please set IT job type on the folder first.",
      });
    }

    // ========= 5) validate FK exists =========
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

    const checkJobType = await pool.query(
      "SELECT it_job_type_id FROM it_job_types WHERE it_job_type_id = $1 AND deleted_at IS NULL LIMIT 1",
      [it_job_type_id]
    );
    if (checkJobType.rowCount === 0) {
      safeUnlink(req.file?.path);
      return res.status(404).json({ ok: false, message: "it job type not found" });
    }

    // ========= 6) prepare meta =========
    const fixedOriginal = fixOriginalName(req.file.originalname);
    const title = String(req.body?.title ?? "").trim() || fixedOriginal;

    // ========= 7) copy file to XAMPP =========
    // ✅ copy หลัง multer เขียนลง uploads แล้ว
    let public_url = null;
    try {
      copyToXampp(req.file.filename, req.file.path);
      public_url = `/top/${req.file.filename}`;
    } catch (e) {
      console.warn("⚠️ copy to XAMPP failed:", e?.message);
      // ไม่ล้ม upload ทั้งก้อน เพื่อไม่พัง flow เดิม
      public_url = null;
    }

    // ========= 8) create document in DB =========
    const doc = await createDocument({
      title,
      public_url, // ✅ NEW
      original_file_name: fixedOriginal,
      stored_file_name: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      folder_id,
      document_type_id,
      it_job_type_id,
      created_by,
    });

    return res.status(201).json({
      ok: true,
      document: doc,
    });
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