import pool from "../db/pool.js";

// helper: แปลงเป็น int แบบปลอดภัย (กัน NaN)
function toInt(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  if (s === "") return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

/**
 * ใช้กับ GET /api/documents?folder_id=...  (ขั้นต่ำ STEP 9)
 * - ดึงเฉพาะในแฟ้ม
 * - ไม่รวมที่ถูกลบ (deleted_at IS NULL)
 */
export async function listDocumentsByFolder(folderId, { limit = 100, offset = 0 } = {}) {
  const folder_id = toInt(folderId, null);
  if (folder_id === null) {
    // ให้ controller จัดการ 400 ได้ แต่ service คืน [] จะไม่ทำให้พัง
    return [];
  }

  const sql = `
    SELECT
      d.document_id,
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.folder_id = $1
      AND d.deleted_at IS NULL
    ORDER BY d.document_id ASC
    LIMIT $2 OFFSET $3;
  `;

  const { rows } = await pool.query(sql, [folder_id, toInt(limit, 100), toInt(offset, 0)]);
  return rows;
}

/**
 * listDocuments: ของเดิมคุณ (รองรับค้นหา q + folderId + paging)
 * ปรับ: กัน NaN ของ folderId / limit / offset ให้ปลอดภัยขึ้น
 */
export async function listDocuments({ q, folderId, limit = 20, offset = 0 }) {
  const values = [];
  const where = [];

  // ✅ แสดงเฉพาะที่ไม่ถูกลบ
  where.push("d.deleted_at IS NULL");

  if (q) {
    values.push(`%${q}%`);
    where.push(`
      (
        d.original_file_name ILIKE $${values.length}
        OR d.stored_file_name ILIKE $${values.length}
        OR COALESCE(d.mime_type,'') ILIKE $${values.length}
        OR COALESCE(d.file_path,'') ILIKE $${values.length}
      )
    `);
  }

  const folder_id = toInt(folderId, null);
  if (folder_id !== null) {
    values.push(folder_id);
    where.push(`d.folder_id = $${values.length}`);
  }

  values.push(toInt(limit, 20));
  const limitIdx = values.length;

  values.push(toInt(offset, 0));
  const offsetIdx = values.length;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      d.document_id,
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    ${whereSql}
    ORDER BY d.document_id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function listTrash({ limit = 20, offset = 0 }) {
  const sql = `
    SELECT
      d.document_id,
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.deleted_at IS NOT NULL
    ORDER BY d.deleted_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const { rows } = await pool.query(sql, [toInt(limit, 20), toInt(offset, 0)]);
  return rows;
}

export async function getDocumentById(documentId) {
  const id = toInt(documentId, null);
  if (id === null) return null;

  const sql = `
    SELECT
      d.document_id,
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.document_id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

export async function createDocument({
  original_file_name,
  stored_file_name,
  file_path,
  file_size,
  mime_type,
  folder_id,
  created_by,
}) {
  const sql = `
    INSERT INTO documents (
      original_file_name,
      stored_file_name,
      file_path,
      file_size,
      mime_type,
      folder_id,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      document_id,
      original_file_name,
      stored_file_name,
      file_path,
      file_size,
      mime_type,
      folder_id,
      created_by,
      created_at,
      deleted_at,
      deleted_by;
  `;

  const values = [
    original_file_name,
    stored_file_name,
    file_path,
    file_size != null ? Number(file_size) : null,
    mime_type,
    toInt(folder_id, null),
    created_by,
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}

export async function softDeleteDocument(documentId, deletedBy) {
  const id = toInt(documentId, null);
  if (id === null) return null;

  const sql = `
    UPDATE documents
    SET deleted_at = NOW(), deleted_by = $2
    WHERE document_id = $1
      AND deleted_at IS NULL
    RETURNING
      document_id, deleted_at, deleted_by;
  `;
  const { rows } = await pool.query(sql, [id, deletedBy]);
  return rows[0] || null;
}

export async function restoreDocument(documentId) {
  const id = toInt(documentId, null);
  if (id === null) return null;

  const sql = `
    UPDATE documents
    SET deleted_at = NULL, deleted_by = NULL
    WHERE document_id = $1
      AND deleted_at IS NOT NULL
    RETURNING
      document_id, deleted_at, deleted_by;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
