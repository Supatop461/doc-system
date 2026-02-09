// src/routes/trash.routes.js
import express from "express";
import pool from "../db/pool.js";
import { authRequired, requireAdmin } from "../middlewares/auth.js";

import fs from "fs";
import path from "path";

const router = express.Router();

// helper: ตรวจ id (รองรับเลข + uuid-ish)
function isValidId(id) {
  if (!id) return false;
  if (/^\d+$/.test(id)) return true; // integer
  if (/^[0-9a-fA-F-]{10,}$/.test(id)) return true; // uuid-ish
  return false;
}

// helper: หา path ไฟล์จริงให้ robust (ไม่พังของเดิม)
function resolveExistingFilePath(row) {
  const fp = row?.file_path ? String(row.file_path) : "";
  const stored = row?.stored_file_name ? String(row.stored_file_name) : "";

  const candidates = [];

  // 1) ถ้า file_path เป็น full file path
  if (fp) candidates.push(fp);

  // 2) ถ้า file_path เป็น directory ให้ join กับ stored_file_name
  if (fp && stored) candidates.push(path.join(fp, stored));

  // 3) ถ้าเป็น relative ให้ resolve จาก cwd
  if (fp) candidates.push(path.resolve(process.cwd(), fp));
  if (fp && stored) candidates.push(path.resolve(process.cwd(), fp, stored));

  // 4) fallback โฟลเดอร์ uploads (เผื่อโปรเจคเก็บไว้ตรงนี้)
  if (stored) {
    candidates.push(path.resolve(process.cwd(), "uploads", stored));
    candidates.push(path.resolve(process.cwd(), "public", "uploads", stored));
  }

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch (_) {}
  }
  return null;
}

/**
 * GET /api/trash
 * GET /api/trash?type=documents
 * GET /api/trash?type=folders
 * GET /api/trash?type=all   (default)
 *
 * ✅ คืนเป็น object: { type, documents:[], folders:[] }
 */
router.get("/", authRequired, requireAdmin, async (req, res) => {
  try {
    const type = String(req.query.type || "all");

    let documents = [];
    let folders = [];

    // ===== documents =====
    if (type === "documents" || type === "all") {
      const { rows } = await pool.query(`
        SELECT
          'document' AS trash_type,

          document_id AS id,
          original_file_name AS name,
          mime_type,
          deleted_at,

          -- fields เดิม (คงไว้)
          document_id,
          original_file_name,
          stored_file_name,
          file_path,
          file_size,
          mime_type,
          folder_id,
          created_by,
          created_at,
          updated_at AS updated_at_orig,
          deleted_at,
          deleted_by,
          document_type_id,
          it_job_type_id,
          created_by_user_id
        FROM documents
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `);
      documents = rows;
    }

    // ===== folders =====
    if (type === "folders" || type === "all") {
      const { rows } = await pool.query(`
        SELECT
          'folder' AS trash_type,

          folder_id AS id,
          name,
          parent_id,
          deleted_at,

          -- fields เดิม (คงไว้)
          folder_id,
          name,
          parent_id,
          created_by,
          created_at,
          deleted_at
        FROM folders
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `);
      folders = rows;
    }

    return res.json({ type, documents, folders });
  } catch (err) {
    console.error("TRASH LIST error:", err);
    return res.status(500).json({ message: "TRASH_LIST_FAILED" });
  }
});

// =======================
// ✅ PREVIEW FILE IN TRASH (NEW)
// =======================
// GET /api/trash/:document_id/file
router.get("/:document_id/file", authRequired, requireAdmin, async (req, res) => {
  try {
    const { document_id } = req.params;

    if (!isValidId(document_id)) {
      return res.status(400).json({ message: "INVALID_DOCUMENT_ID" });
    }

    const { rows } = await pool.query(
      `
      SELECT
        document_id,
        original_file_name,
        stored_file_name,
        file_path,
        file_size,
        mime_type,
        deleted_at
      FROM documents
      WHERE document_id = $1
        AND deleted_at IS NOT NULL
      LIMIT 1
      `,
      [document_id]
    );

    if (!rows.length) return res.status(404).json({ message: "NOT_FOUND_IN_TRASH" });

    const doc = rows[0];
    const realPath = resolveExistingFilePath(doc);

    if (!realPath) {
      return res.status(404).json({ message: "FILE_NOT_FOUND_ON_DISK" });
    }

    const mime = doc.mime_type || "application/octet-stream";
    const originalName = doc.original_file_name || `file-${document_id}`;

    // ✅ ให้ pdf/รูปพรีวิวได้ (inline), ไฟล์อื่นยังดาวน์โหลดได้อยู่
    const isInline = /^application\/pdf$/i.test(mime) || /^image\//i.test(mime);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `${isInline ? "inline" : "attachment"}; filename="${encodeURIComponent(originalName)}"`
    );

    return res.sendFile(realPath);
  } catch (err) {
    console.error("TRASH FILE PREVIEW error:", err);
    return res.status(500).json({ message: "TRASH_FILE_PREVIEW_FAILED" });
  }
});

// =======================
// RESTORE DOCUMENT (เดิม)
// =======================
async function restoreDocument(req, res) {
  try {
    const { document_id } = req.params;

    if (!isValidId(document_id)) {
      return res.status(400).json({ message: "INVALID_DOCUMENT_ID" });
    }

    const { rowCount } = await pool.query(
      `
      UPDATE documents
      SET deleted_at = NULL,
          deleted_by = NULL,
          updated_at = NOW()
      WHERE document_id = $1
        AND deleted_at IS NOT NULL
      `,
      [document_id]
    );

    if (!rowCount) return res.status(404).json({ message: "NOT_FOUND_IN_TRASH" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("TRASH RESTORE DOCUMENT error:", err);
    return res.status(500).json({ message: "TRASH_RESTORE_FAILED" });
  }
}

// =======================
// RESTORE FOLDER (CASCADE)
// =======================
router.post("/folders/:folder_id/restore", authRequired, requireAdmin, async (req, res) => {
  try {
    const { folder_id } = req.params;
    if (!isValidId(folder_id)) {
      return res.status(400).json({ message: "INVALID_FOLDER_ID" });
    }

    const rootId = Number(folder_id);

    // ✅ หา descendants ทั้งหมดด้วย recursive CTE (รวมตัวมันเอง)
    const findSql = `
      WITH RECURSIVE tree AS (
        SELECT folder_id
        FROM folders
        WHERE folder_id = $1

        UNION ALL

        SELECT f.folder_id
        FROM folders f
        JOIN tree t ON f.parent_id = t.folder_id
      )
      SELECT folder_id FROM tree
    `;
    const found = await pool.query(findSql, [rootId]);
    const ids = found.rows.map((r) => r.folder_id);

    if (ids.length === 0) {
      return res.status(404).json({ message: "FOLDER_NOT_FOUND" });
    }

    // ✅ restore ทั้งกิ่ง (เฉพาะที่อยู่ในถังขยะ)
    const restoreSql = `
      UPDATE folders
      SET deleted_at = NULL,
          updated_at = NOW()
      WHERE folder_id = ANY($1::int[])
        AND deleted_at IS NOT NULL
    `;
    await pool.query(restoreSql, [ids]);

    return res.json({ ok: true, restored_folder_ids: ids });
  } catch (err) {
    console.error("TRASH RESTORE FOLDER error:", err);
    return res.status(500).json({ message: "FOLDER_RESTORE_FAILED" });
  }
});

/**
 * ✅ POST /api/trash/:document_id/restore
 * ✅ PATCH /api/trash/:document_id/restore
 */
router.post("/:document_id/restore", authRequired, requireAdmin, restoreDocument);
router.patch("/:document_id/restore", authRequired, requireAdmin, restoreDocument);

/**
 * ❌ ปิดลบถาวร (เหมือนเดิม เพื่อความปลอดภัย)
 */
router.delete("/:id", authRequired, requireAdmin, (_req, res) => {
  return res.status(405).json({ message: "PERMANENT_DELETE_DISABLED" });
});

router.delete("/", authRequired, requireAdmin, (_req, res) => {
  return res.status(405).json({ message: "EMPTY_TRASH_DISABLED" });
});

export default router;