import { z } from "zod";
import fs from "fs";
import path from "path";
import * as docs from "../services/documents.service.js";

// ✅ รองรับทั้ง folder_id และ folderId
const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),

  // รับได้ 2 แบบ: folder_id หรือ folderId
  folder_id: z.coerce.number().int().positive().optional(),
  folderId: z.coerce.number().int().positive().optional(),

  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const trashQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// (optional) ถ้าคุณยังอยากมี create แบบยิง JSON ตรง ๆ ก็เก็บไว้ได้
const createSchema = z.object({
  original_file_name: z.string().trim().min(1),
  stored_file_name: z.string().trim().min(1),
  file_path: z.string().trim().min(1),
  file_size: z.coerce.number().int().nonnegative(),
  mime_type: z.string().trim().min(1),
  folder_id: z.coerce.number().int().positive().nullable().optional(),
  created_by: z.string().trim().min(1),
});

// ✅ เดิม: ต้องส่ง deleted_by
// ✅ ใหม่: ถ้ามี auth แล้ว ใช้ req.user.id ได้โดยไม่ต้องส่ง body
const deleteBodySchema = z
  .object({
    deleted_by: z.string().trim().min(1).optional(),
  })
  .optional();

export async function listDocuments(req, res) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    // ✅ map folder_id ให้เข้ากับ service เดิมของคุณ (folderId)
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

export async function listTrash(req, res) {
  try {
    const parsed = trashQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const rows = await docs.listTrash(parsed.data);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listTrash error:", err);
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

// (optional) ยิง JSON ตรง ๆ (ไม่ใช้ใน STEP 9 ถ้าเราใช้ upload controller เป็น POST /)
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

    const uploadsRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const absFilePath = path.resolve(doc.file_path);

    // กัน path traversal
    if (!absFilePath.startsWith(uploadsRoot)) {
      return res.status(400).json({ ok: false, error: "INVALID_FILE_PATH" });
    }
    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ ok: false, error: "FILE_NOT_FOUND" });
    }

    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.original_file_name || `document_${doc.document_id}`)}"`
    );

    fs.createReadStream(absFilePath).pipe(res);
  } catch (err) {
    console.error("downloadDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// ✅ SOFT DELETE
export async function deleteDocument(req, res) {
  try {
    const parsedId = idParamSchema.safeParse(req.params);
    if (!parsedId.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    // ✅ ใช้ req.user.id ก่อน ถ้าไม่มีค่อยดู body.deleted_by
    const parsedBody = deleteBodySchema?.safeParse?.(req.body);
    if (parsedBody && !parsedBody.success) {
      return res.status(400).json({ ok: false, error: parsedBody.error.flatten() });
    }

    const deleted_by = req.user?.id ?? parsedBody?.data?.deleted_by ?? null;
    if (!deleted_by) {
      return res.status(400).json({ ok: false, error: "deleted_by is required (or login to use req.user.id)" });
    }

    const result = await docs.softDeleteDocument(parsedId.data.id, deleted_by);
    if (!result) return res.status(404).json({ ok: false, error: "NOT_FOUND_OR_ALREADY_DELETED" });

    return res.json({ ok: true, data: result });
  } catch (err) {
    console.error("deleteDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// ✅ RESTORE
export async function restoreDocument(req, res) {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const result = await docs.restoreDocument(parsed.data.id);
    if (!result) return res.status(404).json({ ok: false, error: "NOT_FOUND_OR_NOT_DELETED" });

    return res.json({ ok: true, data: result });
  } catch (err) {
    console.error("restoreDocument error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}
