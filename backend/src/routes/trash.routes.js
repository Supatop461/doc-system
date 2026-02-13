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

// =======================
// ✅ Column-introspection (กัน SELECT คอลัมน์ที่ถูกลบ/ไม่มี)
// =======================
let _docCols = null;
let _folderCols = null;

async function getCols(tableName) {
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    `,
    [tableName]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function ensureColsLoaded() {
  if (!_docCols) _docCols = await getCols("documents");
  if (!_folderCols) _folderCols = await getCols("folders");
}

function colOrNull(cols, colName, alias = null, tableAlias = null) {
  const ta = tableAlias ? `${tableAlias}.` : "";
  const as = alias ? ` AS ${alias}` : "";
  return cols.has(colName) ? `${ta}${colName}${as}` : `NULL${as || (alias ? ` AS ${alias}` : "")}`;
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

    await ensureColsLoaded();

    let documents = [];
    let folders = [];

    // ===== documents =====
    if (type === "documents" || type === "all") {
      // สร้าง SELECT แบบปลอดภัย: ถ้าคอลัมน์ไม่มี -> NULL (ไม่พัง)
      const docSelect = `
        SELECT
          'document' AS trash_type,

          document_id AS id,
          original_file_name AS name,
          ${colOrNull(_docCols, "mime_type")} AS mime_type,
          ${colOrNull(_docCols, "deleted_at")} AS deleted_at,

          -- fields เดิม (คงไว้เท่าที่มีจริง)
          ${colOrNull(_docCols, "document_id")} AS document_id,
          ${colOrNull(_docCols, "title")} AS title,
          ${colOrNull(_docCols, "original_file_name")} AS original_file_name,
          ${colOrNull(_docCols, "stored_file_name")} AS stored_file_name,
          ${colOrNull(_docCols, "file_path")} AS file_path,
          ${colOrNull(_docCols, "file_size")} AS file_size,
          ${colOrNull(_docCols, "mime_type")} AS mime_type,
          ${colOrNull(_docCols, "folder_id")} AS folder_id,
          ${colOrNull(_docCols, "created_by")} AS created_by,
          ${colOrNull(_docCols, "created_at")} AS created_at,
          ${colOrNull(_docCols, "updated_at")} AS updated_at_orig,
          ${colOrNull(_docCols, "deleted_at")} AS deleted_at_dup,
          ${colOrNull(_docCols, "deleted_by")} AS deleted_by,
          ${colOrNull(_docCols, "document_type_id")} AS document_type_id,
          ${colOrNull(_docCols, "it_job_type_id")} AS it_job_type_id,
          ${colOrNull(_docCols, "created_by_user_id")} AS created_by_user_id,
          ${colOrNull(_docCols, "public_url")} AS public_url
        FROM documents
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;

      const { rows } = await pool.query(docSelect);
      documents = rows;
    }

    // ===== folders =====
    if (type === "folders" || type === "all") {
      const folderSelect = `
        SELECT
          'folder' AS trash_type,

          folder_id AS id,
          name,
          parent_id,
          ${colOrNull(_folderCols, "deleted_at")} AS deleted_at,

          -- fields เดิม (คงไว้เท่าที่มีจริง)
          ${colOrNull(_folderCols, "folder_id")} AS folder_id,
          ${colOrNull(_folderCols, "name")} AS name_dup,
          ${colOrNull(_folderCols, "parent_id")} AS parent_id_dup,
          ${colOrNull(_folderCols, "created_by")} AS created_by,
          ${colOrNull(_folderCols, "created_at")} AS created_at,
          ${colOrNull(_folderCols, "updated_at")} AS updated_at,
          ${colOrNull(_folderCols, "deleted_at")} AS deleted_at_dup,
          ${colOrNull(_folderCols, "deleted_by")} AS deleted_by
        FROM folders
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;

      const { rows } = await pool.query(folderSelect);
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

    // NOTE: folders ปกติเป็น int — ถ้าไม่ใช่เลข ให้แจ้งตรงๆ กันพัง
    if (!/^\d+$/.test(String(folder_id))) {
      return res.status(400).json({ message: "FOLDER_ID_MUST_BE_INTEGER" });
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