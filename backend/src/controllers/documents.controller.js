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

  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),

  // ✅ รวมไฟล์จาก TOP ด้วย (default true)
  include_top: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase().trim();
      if (s === "0" || s === "false" || s === "no") return false;
      return true;
    }),
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

// ✅ TOP root (XAMPP)
function getTopRoot() {
  return path.resolve(process.env.TOP_PUBLIC_DIR || "C:/xampp/htdocs/top");
}

function safeHeaderFilename(name = "") {
  return String(name).replace(/[\r\n"]/g, "").trim();
}

/**
 * ✅ ทำ Content-Disposition รองรับชื่อไทยด้วย filename*
 */
function setContentDisposition(res, type, filename) {
  const clean = safeHeaderFilename(filename) || "download";
  const encoded = encodeURIComponent(clean);
  const fallback = clean.replace(/[^\x20-\x7E]/g, "_") || "download";

  res.setHeader(
    "Content-Disposition",
    `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
  );
}

function extOf(name = "") {
  const m = String(name).match(/(\.[a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "";
}

function guessMimeByExt(filename = "") {
  const ext = extOf(filename);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

// ✅ กัน path traversal: รับแค่ชื่อไฟล์ “ตัวเดียว”
function safeBasename(filename = "") {
  const base = path.basename(String(filename || ""));
  if (!base || base === "." || base === "..") return null;
  // กันตัวอักษรเสี่ยงๆ (อนุญาตไทยได้ แต่กัน / \ : และ null)
  if (/[\/\\:\0]/.test(base)) return null;
  return base;
}

// ✅ อ่าน user_id เป็นตัวเลข (ใช้ created_by ตอน sync + deleted_by ตอนลบ)
function getNumericUserId(req) {
  const raw =
    req.user?.user_id ??
    req.user?.id ??
    req.user?.userId ??
    req.user?.created_by_user_id;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ✅ อ่านรายการไฟล์จาก TOP
function scanTopFiles() {
  const root = getTopRoot();
  if (!fs.existsSync(root)) return [];

  const trashDir = path.join(root, "_trash");

  let items = [];
  try {
    const names = fs.readdirSync(root);
    for (const name of names) {
      if (!name) continue;
      if (name === "_trash") continue;

      const abs = path.join(root, name);
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;

      items.push({
        source: "TOP",
        // ✅ id สำหรับหน้าเว็บ (ไม่ชน DB id) — ใช้ตอนยังไม่ sync เท่านั้น
        document_id: `top_${encodeURIComponent(name)}`,
        title: name.replace(/\.[^.]+$/, ""),
        original_file_name: name,
        stored_file_name: name,
        file_path: abs, // absolute
        public_url: `/top/${name}`,
        file_size: st.size,
        mime_type: guessMimeByExt(name),
        folder_id: null,
        created_at: st.birthtime || st.mtime,
        updated_at: st.mtime,
        deleted_at: null,
        deleted_by: null,
        __top_trash_dir: trashDir,
      });
    }
  } catch {
    items = [];
  }

  // newest first
  items.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  return items;
}

/**
 * resolve path จาก doc.file_path ให้เป็น absolute + ตรวจให้ปลอดภัย
 * ✅ ปรับ: ถ้ามี public_url = /top/xxx ให้พยายามอ่านจาก TOP ก่อน
 */
function resolveSafeAbsPathFromDoc(doc) {
  // 1) TOP first (ถ้ามี public_url แบบ /top/filename)
  const pub = String(doc?.public_url || "").trim();
  if (pub.startsWith("/top/")) {
    const filename = safeBasename(pub.slice("/top/".length));
    if (filename) {
      const absTop = path.join(getTopRoot(), filename);
      if (fs.existsSync(absTop)) {
        return { ok: true, absFilePath: absTop, source: "TOP" };
      }
    }
  }

  // 2) fallback uploads 방식เดิม
  const filePath = doc?.file_path;
  if (!filePath) return { ok: false, error: "NO_FILE_PATH" };

  const uploadsRoot = getUploadsRoot();

  let absFilePath;
  if (path.isAbsolute(filePath)) {
    absFilePath = path.resolve(filePath);
  } else {
    absFilePath = path.resolve(process.cwd(), filePath);
  }

  const rel = path.relative(uploadsRoot, absFilePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: "INVALID_FILE_PATH" };
  }

  return { ok: true, absFilePath, source: "UPLOADS" };
}

function pickDownloadName(doc, fallbackId) {
  const base = doc?.title?.trim()
    ? doc.title.trim()
    : doc?.original_file_name?.trim()
    ? doc.original_file_name.trim()
    : `document_${doc?.document_id || fallbackId}`;

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

    // 1) DB documents (ดึงมามากพอเพื่อ merge/sync แล้วค่อย paginate)
    const dbRows = await docs.listDocuments({
      q: parsed.data.q,
      folderId,
      limit: 5000,
      offset: 0,
    });

    // set กันซ้ำด้วย stored_file_name และ public_url
    const seen = new Set();
    for (const d of dbRows) {
      const sfn = String(d?.stored_file_name || "").trim();
      const pub = String(d?.public_url || "").trim();
      if (sfn) seen.add(`s:${sfn}`);
      if (pub) seen.add(`p:${pub}`);
    }

    // 2) TOP files (optional)
    let topRows = [];
    if (parsed.data.include_top) {
      topRows = scanTopFiles();

      // keyword filter สำหรับ TOP (ให้เหมือน DB)
      const q = String(parsed.data.q || "").trim().toLowerCase();
      if (q) {
        topRows = topRows.filter((t) => {
          const n = String(t.title || "").toLowerCase();
          const f = String(t.original_file_name || "").toLowerCase();
          const m = String(t.mime_type || "").toLowerCase();
          return n.includes(q) || f.includes(q) || m.includes(q);
        });
      }

      // ✅ NEW: AUTO SYNC TOP → DB (แบบ 1)
      // ถ้าเจอไฟล์ใน TOP ที่ยังไม่มีใน DB → insert record ให้อัตโนมัติ
      const createdBy = getNumericUserId(req);

      if (createdBy !== null) {
        for (const t of topRows) {
          const sfn = String(t.stored_file_name || "").trim();
          const pub = String(t.public_url || "").trim();

          // ถ้า DB มีแล้ว (seen) ข้าม
          if ((sfn && seen.has(`s:${sfn}`)) || (pub && seen.has(`p:${pub}`))) continue;

          // กันซ้ำอีกชั้นจาก DB (กรณี seen ยังไม่ทัน)
          let exists = null;
          if (pub) exists = await docs.getDocumentByPublicUrl(pub);
          if (!exists && sfn) exists = await docs.getDocumentByStoredFileName(sfn);

          if (exists) {
            // mark seen แล้วข้าม
            const esfn = String(exists?.stored_file_name || "").trim();
            const epub = String(exists?.public_url || "").trim();
            if (esfn) seen.add(`s:${esfn}`);
            if (epub) seen.add(`p:${epub}`);
            continue;
          }

          // สร้าง record ใหม่
          const inserted = await docs.createDocument({
            title: t.title,
            public_url: pub || null,

            original_file_name: t.original_file_name,
            stored_file_name: t.stored_file_name,

            // ไฟล์ถูกวางตรงใน TOP → เก็บ abs path ไว้ได้
            file_path: t.file_path,
            file_size: t.file_size,
            mime_type: t.mime_type,

            // TOP = ไฟล์กลาง
            folder_id: null,
            document_type_id: null,
            it_job_type_id: null,

            created_by: createdBy,
          });

          // เพิ่มเข้า dbRows เพื่อให้ response รอบนี้เป็น “DB แล้ว”
          dbRows.push(inserted);

          const nsfn = String(inserted?.stored_file_name || "").trim();
          const npub = String(inserted?.public_url || "").trim();
          if (nsfn) seen.add(`s:${nsfn}`);
          if (npub) seen.add(`p:${npub}`);
        }
      }

      // หลัง sync แล้ว: เหลือเฉพาะ TOP ที่ยังไม่มี DB จริง ๆ (เช่น createdBy ไม่มี)
      topRows = topRows.filter((t) => {
        const sfn = String(t.stored_file_name || "").trim();
        const pub = String(t.public_url || "").trim();
        if (sfn && seen.has(`s:${sfn}`)) return false;
        if (pub && seen.has(`p:${pub}`)) return false;
        return true;
      });
    }

    // 3) merge + sort newest first
    const merged = [...dbRows, ...topRows].sort((a, b) => {
      const ta = new Date(a?.updated_at ?? a?.created_at ?? 0).getTime();
      const tb = new Date(b?.updated_at ?? b?.created_at ?? 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(b?.document_id || "").localeCompare(String(a?.document_id || ""));
    });

    // 4) paging
    const start = parsed.data.offset;
    const end = start + parsed.data.limit;
    const page = merged.slice(start, end);

    return res.json({
      ok: true,
      data: page,
      meta: {
        total: merged.length,
        db_count: dbRows.length,
        top_count: topRows.length,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        include_top: parsed.data.include_top,
      },
    });
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

// ✅ NEW: rename title
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

    const resolved = resolveSafeAbsPathFromDoc(doc);
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

// ✅ preview (inline)
export async function previewDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const doc = await docs.getDocumentById(parsed.data.id);
    if (!doc) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const resolved = resolveSafeAbsPathFromDoc(doc);
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

// =========================
// ✅ NEW: delete document (แทน SQL ใน routes เพื่อไม่มั่ว)
// =========================
export async function deleteDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const deletedBy = getNumericUserId(req);
    if (deletedBy === null) {
      return res.status(400).json({ ok: false, error: "INVALID_USER_ID_FOR_DELETE" });
    }

    const doc = await docs.getDocumentById(parsed.data.id);
    if (!doc) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    // soft delete in DB
    const updated = await docs.softDeleteDocument(parsed.data.id, deletedBy);
    if (!updated) return res.status(404).json({ ok: false, error: "NOT_FOUND_OR_ALREADY_DELETED" });

    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// =========================
// ✅ TOP direct handlers (ไฟล์ที่อยู่ใน /top แต่ไม่มี DB)
// =========================

export async function downloadTopFile(req, res) {
  try {
    const base = safeBasename(req.params.name);
    if (!base) return res.status(400).json({ ok: false, error: "INVALID_FILE_NAME" });

    const abs = path.join(getTopRoot(), base);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });

    res.setHeader("Content-Type", guessMimeByExt(base));
    setContentDisposition(res, "attachment", base);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error("downloadTopFile error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

export async function previewTopFile(req, res) {
  try {
    const base = safeBasename(req.params.name);
    if (!base) return res.status(400).json({ ok: false, error: "INVALID_FILE_NAME" });

    const abs = path.join(getTopRoot(), base);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });

    res.setHeader("Content-Type", guessMimeByExt(base));
    setContentDisposition(res, "inline", base);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error("previewTopFile error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

export async function deleteTopFile(req, res) {
  try {
    const base = safeBasename(req.params.name);
    if (!base) return res.status(400).json({ ok: false, error: "INVALID_FILE_NAME" });

    const topRoot = getTopRoot();
    const abs = path.join(topRoot, base);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });

    const trashDir = path.join(topRoot, "_trash");
    if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}`;
    const dest = path.join(trashDir, unique);

    fs.renameSync(abs, dest);

    return res.json({ ok: true, moved_to: `_trash/${unique}` });
  } catch (err) {
    console.error("deleteTopFile error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}