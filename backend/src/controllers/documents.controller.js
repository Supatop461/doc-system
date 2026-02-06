// src/controllers/documents.controller.js
import { z } from "zod";
import fs from "fs";
import path from "path";
import * as docs from "../services/documents.service.js";

// =========================
// Schemas
// =========================

// ✅ รองรับทั้ง folder_id และ folderId
const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),

  folder_id: z.coerce.number().int().positive().optional(),
  folderId: z.coerce.number().int().positive().optional(),

  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ✅ รองรับทั้งเลข / uuid-ish / nanoid-ish (ให้สอดคล้องกับ routes)
const idParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .refine((v) => {
      if (/^\d+$/.test(v)) return true; // integer
      if (/^[0-9a-fA-F-]{10,}$/.test(v)) return true; // uuid-ish
      if (/^[0-9a-zA-Z_-]{10,}$/.test(v)) return true; // nanoid/ulid-ish
      return false;
    }, "INVALID_ID"),
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

// ✅ NEW: rename title
const renameSchema = z.object({
  title: z.string().trim().min(1).max(255),
});

// =========================
// Helpers
// =========================

function getUploadsRoot() {
  return path.resolve(process.cwd(), process.env.UPLOAD_PATH || "uploads");
}

/**
 * resolve path จาก doc.file_path ให้เป็น absolute + ตรวจให้ปลอดภัย
 * รองรับทั้ง:
 *  - file_path เก็บเป็น absolute
 *  - file_path เก็บเป็น relative เช่น "uploads/xxx.pdf" หรือ "xxx.pdf"
 */
function resolveSafeAbsPath(filePath) {
  if (!filePath) return { ok: false, error: "NO_FILE_PATH" };

  const uploadsRoot = getUploadsRoot();

  // 1) ทำให้เป็น absolute
  let absFilePath;
  if (path.isAbsolute(filePath)) {
    absFilePath = path.resolve(filePath);
  } else {
    // ถ้าใน db เก็บ "uploads/..." หรือ "xxx" ให้ resolve จาก cwd
    absFilePath = path.resolve(process.cwd(), filePath);
  }

  // 2) กัน path traversal: ต้องอยู่ใต้ uploadsRoot เท่านั้น
  const rel = path.relative(uploadsRoot, absFilePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: "INVALID_FILE_PATH" };
  }

  return { ok: true, uploadsRoot, absFilePath };
}

function safeHeaderFilename(name = "") {
  // กันตัวอักษรควบคุมที่ทำให้ header แตก
  return String(name).replace(/[\r\n"]/g, "").trim();
}

/**
 * ✅ ทำ Content-Disposition รองรับชื่อไทยด้วย filename*
 * - ใส่ทั้ง filename="ascii-ish" และ filename*=UTF-8''...
 */
function setContentDisposition(res, type, filename) {
  const clean = safeHeaderFilename(filename) || "download";
  const encoded = encodeURIComponent(clean);

  // fallback แบบไม่ทำให้ header พัง (แทนตัวอักษรที่ไม่ใช่ ASCII)
  const fallback = clean.replace(/[^\x20-\x7E]/g, "_") || "download";

  res.setHeader(
    "Content-Disposition",
    `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
  );
}

function pickDownloadName(doc, fallbackId) {
  // ✅ ให้ชื่อดาวน์โหลดอิง title ก่อน (เพราะ title แก้ได้)
  const base = doc?.title?.trim()
    ? doc.title.trim()
    : doc?.original_file_name?.trim()
    ? doc.original_file_name.trim()
    : `document_${doc?.document_id || fallbackId}`;

  // พยายามคงนามสกุลเดิมจาก original_file_name (ถ้ามี)
  const ext = path.extname(String(doc?.original_file_name || "")).trim();
  if (ext && !base.toLowerCase().endsWith(ext.toLowerCase())) return `${base}${ext}`;
  return base;
}

// =========================
// Controllers
// =========================

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
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "INVALID_ID" });
    }

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
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const created = await docs.createDocument(parsed.data);
    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    console.error("createDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// ✅ NEW: rename title (แก้ชื่อเอกสารให้หน้า list เปลี่ยนจริง)
export async function renameDocument(req, res) {
  try {
    const p = idParamSchema.safeParse(req.params);
    if (!p.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const b = renameSchema.safeParse(req.body);
    if (!b.success) {
      return res.status(400).json({ ok: false, error: b.error.flatten() });
    }

    const updated = await docs.renameDocumentTitle({
      id: p.data.id,
      title: b.data.title,
    });

    if (!updated) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("renameDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// ✅ download (attachment)
export async function downloadDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const doc = await docs.getDocumentById(parsed.data.id);
    if (!doc) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const resolved = resolveSafeAbsPath(doc.file_path);
    if (!resolved.ok) return res.status(400).json({ ok: false, error: resolved.error });

    const { absFilePath } = resolved;

    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });
    }

    const filename = pickDownloadName(doc, parsed.data.id);

    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    setContentDisposition(res, "attachment", filename);

    fs.createReadStream(absFilePath).pipe(res);
  } catch (err) {
    console.error("downloadDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * ✅ preview (inline)
 * ใช้กับ modal preview: PDF/รูป จะเปิดใน browser ได้
 * หมายเหตุ: ฝั่ง frontend ใช้ <iframe src="/api/documents/:id/preview"> ได้เลย
 */
export async function previewDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const doc = await docs.getDocumentById(parsed.data.id);
    if (!doc) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const resolved = resolveSafeAbsPath(doc.file_path);
    if (!resolved.ok) return res.status(400).json({ ok: false, error: resolved.error });

    const { absFilePath } = resolved;

    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });
    }

    const filename = pickDownloadName(doc, parsed.data.id);

    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    setContentDisposition(res, "inline", filename);

    fs.createReadStream(absFilePath).pipe(res);
  } catch (err) {
    console.error("previewDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}