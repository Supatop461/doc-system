// src/controllers/documents.controller.js
import { z } from "zod";
import fs from "fs";
import path from "path";
import * as docs from "../services/documents.service.js";

// ✅ รองรับทั้ง folder_id และ folderId
const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),

  folder_id: z.coerce.number().int().positive().optional(),
  folderId: z.coerce.number().int().positive().optional(),

  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// (optional) ถ้าคุณยังอยากมี create แบบยิง JSON ตรง ๆ ก็เก็บไว้ได้
// ⚠️ แนะนำปิด/ลบ ถ้าไม่ได้ใช้จริง เพื่อลดช่อง insert path ปลอม
const createSchema = z.object({
  original_file_name: z.string().trim().min(1),
  stored_file_name: z.string().trim().min(1),
  file_path: z.string().trim().min(1),
  file_size: z.coerce.number().int().nonnegative(),
  mime_type: z.string().trim().min(1),
  folder_id: z.coerce.number().int().positive().nullable().optional(),
  created_by: z.string().trim().min(1),
});

export async function listDocuments(req, res) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const folderId = parsed.data.folder_id ?? parsed.data.folderId;

    const rows = await docs.listDocuments({
      q: parsed.data.q,
      folderId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listDocuments error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

export async function getDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const row = await docs.getDocumentById(parsed.data.id);
    if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.json({ ok: true, data: row });
  } catch (err) {
    console.error("getDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// (optional) ยิง JSON ตรง ๆ (ถ้าไม่ได้ใช้จริง แนะนำลบ/ปิด)
export async function createDocument(req, res) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const created = await docs.createDocument(parsed.data);
    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    console.error("createDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// ✅ download
export async function downloadDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const doc = await docs.getDocumentById(parsed.data.id);
    if (!doc) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!doc.file_path) return res.status(400).json({ ok: false, error: "NO_FILE_PATH" });

    // uploads root (ควรตรงกับที่ upload controller ใช้)
    const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOAD_PATH || "uploads");
    const absFilePath = path.resolve(doc.file_path);

    // ✅ กัน path traversal แบบชัวร์
    const rel = path.relative(uploadsRoot, absFilePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return res.status(400).json({ ok: false, error: "INVALID_FILE_PATH" });
    }

    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });
    }

    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(
        doc.original_file_name || `document_${doc.document_id}`
      )}"`
    );

    fs.createReadStream(absFilePath).pipe(res);
  } catch (err) {
    console.error("downloadDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}
