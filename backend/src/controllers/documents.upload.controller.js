import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db/pool.js";
import { createDocument } from "../services/documents.service.js";

// ========== multer config ==========
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${safeName}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadSingleFile = uploader.single("file");

// helper
function toInt(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function uploadDocument(req, res) {
  try {
    const folder_id = toInt(req.body?.folder_id);

    if (!folder_id) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({ ok: false, message: "folder_id is required and must be number" });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, message: "file is required (field name: file)" });
    }

    // ✅ เช็ค folder มีจริง (กัน folder_id หลอก / กัน insert แล้วเป็น null)
    const check = await pool.query("SELECT folder_id FROM folders WHERE folder_id = $1 LIMIT 1", [folder_id]);
    if (check.rowCount === 0) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(404).json({ ok: false, message: "folder not found" });
    }

    const created_by = req.userId ?? req.user?.id ?? null;

    const doc = await createDocument({
      original_file_name: req.file.originalname,
      stored_file_name: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      folder_id,      // ✅ ส่งเป็น number แน่นอน
      created_by,
    });

    return res.status(201).json({ ok: true, document: doc });
  } catch (err) {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, message: "File too large" });
    }

    console.error("uploadDocument error:", err);

    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
}
