// src/services/documents.service.js
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

// ✅ cache columns ของตาราง documents เพื่อทำ SQL แบบ "ไม่พังของเก่า"
let _docColsCache = null;
let _docTitleCol = null;
let _docPublicUrlCol = null;

async function getDocumentsColumns() {
  if (_docColsCache) return _docColsCache;

  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='documents'`
  );

  _docColsCache = new Set(rows.map((r) => r.column_name));

  // เลือกชื่อคอลัมน์ title ที่เป็นไปได้
  const candidates = ["title", "document_title", "doc_title", "document_name", "name"];
  _docTitleCol = candidates.find((c) => _docColsCache.has(c)) || null;

  // ✅ public url column
  const pubCandidates = ["public_url", "public_path", "public_link"];
  _docPublicUrlCol = pubCandidates.find((c) => _docColsCache.has(c)) || null;

  return _docColsCache;
}

async function getTitleSelectFragment() {
  await getDocumentsColumns();
  if (_docTitleCol) return `d.${_docTitleCol} AS title,`;
  return `NULL AS title,`;
}

async function getPublicUrlSelectFragment() {
  await getDocumentsColumns();
  if (_docPublicUrlCol) return `d.${_docPublicUrlCol} AS public_url,`;
  return `NULL AS public_url,`;
}

async function getTitleInsertColsAndParams(values) {
  await getDocumentsColumns();
  if (!_docTitleCol) return { cols: "", vals: "", added: false };

  values.push(null);
  const idx = values.length;
  return {
    cols: `, ${_docTitleCol}`,
    vals: `, $${idx}`,
    added: true,
    idx,
  };
}

async function getPublicUrlInsertColsAndParams(values) {
  await getDocumentsColumns();
  if (!_docPublicUrlCol) return { added: false, idx: null };

  values.push(null);
  const idx = values.length;
  return { added: true, idx };
}

/**
 * ใช้กับ GET /api/documents?folder_id=...  (ขั้นต่ำ STEP 9)
 */
export async function listDocumentsByFolder(folderId, { limit = 100, offset = 0 } = {}) {
  const folder_id = toInt(folderId, null);
  if (folder_id === null) return [];

  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      d.document_type_id,
      d.it_job_type_id,

      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.folder_id = $1
      AND d.deleted_at IS NULL
    ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.document_id DESC
    LIMIT $2 OFFSET $3;
  `;

  const { rows } = await pool.query(sql, [folder_id, toInt(limit, 100), toInt(offset, 0)]);
  return rows;
}

/**
 * listDocuments: ของเดิมคุณ (รองรับค้นหา q + folderId + paging)
 */
export async function listDocuments({ q, folderId, limit = 20, offset = 0 }) {
  const values = [];
  const where = [];

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

  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      d.document_type_id,
      d.it_job_type_id,

      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    ${whereSql}
    ORDER BY COALESCE(d.updated_at, d.created_at) DESC, d.document_id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function listTrash({ limit = 20, offset = 0 }) {
  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      d.document_type_id,
      d.it_job_type_id,

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

  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      d.document_type_id,
      d.it_job_type_id,

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

// =========================
// ✅ NEW: lookup by public_url / stored_file_name (ใช้สำหรับ sync TOP→DB)
// =========================
export async function getDocumentByPublicUrl(publicUrl) {
  await getDocumentsColumns();
  if (!_docPublicUrlCol) return null;

  const v = String(publicUrl || "").trim();
  if (!v) return null;

  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.document_type_id,
      d.it_job_type_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.${_docPublicUrlCol} = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [v]);
  return rows[0] || null;
}

export async function getDocumentByStoredFileName(storedFileName) {
  const v = String(storedFileName || "").trim();
  if (!v) return null;

  const titleFrag = await getTitleSelectFragment();
  const pubFrag = await getPublicUrlSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      ${pubFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.document_type_id,
      d.it_job_type_id,
      d.created_by,
      d.created_at,
      d.deleted_at,
      d.deleted_by
    FROM documents d
    WHERE d.stored_file_name = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [v]);
  return rows[0] || null;
}

export async function createDocument({
  title,
  public_url, // ✅ NEW

  original_file_name,
  stored_file_name,
  file_path,
  file_size,
  mime_type,
  folder_id,
  document_type_id,
  it_job_type_id,
  created_by,
}) {
  const values = [];

  // เตรียม insert title แบบ dynamic
  const titleInsert = await getTitleInsertColsAndParams(values);
  if (titleInsert.added) {
    values[titleInsert.idx - 1] = String(title ?? "").trim() || null;
  }

  // เตรียม insert public_url แบบ dynamic
  const pubInsert = await getPublicUrlInsertColsAndParams(values);
  if (pubInsert.added) {
    values[pubInsert.idx - 1] = String(public_url ?? "").trim() || null;
  }

  // ต่อด้วยฟิลด์เดิมทั้งหมด
  values.push(original_file_name);
  values.push(stored_file_name);
  values.push(file_path);
  values.push(file_size != null ? Number(file_size) : null);
  values.push(mime_type);
  values.push(toInt(folder_id, null));
  values.push(toInt(document_type_id, null));
  values.push(toInt(it_job_type_id, null));
  values.push(created_by);

  // จำนวน dynamic ที่เพิ่มหน้า field เดิม
  const dynCount = (titleInsert.added ? 1 : 0) + (pubInsert.added ? 1 : 0);

  // ตำแหน่งพารามิเตอร์ของ field เดิม
  const p1 = 1 + dynCount;
  const p2 = 2 + dynCount;
  const p3 = 3 + dynCount;
  const p4 = 4 + dynCount;
  const p5 = 5 + dynCount;
  const p6 = 6 + dynCount;
  const p7 = 7 + dynCount;
  const p8 = 8 + dynCount;
  const p9 = 9 + dynCount;

  await getDocumentsColumns();

  const titleReturnFrag = _docTitleCol ? `${_docTitleCol} AS title,` : `NULL AS title,`;
  const pubReturnFrag = _docPublicUrlCol ? `${_docPublicUrlCol} AS public_url,` : `NULL AS public_url,`;

  // สร้างส่วนคอลัมน์ dynamic ใน INSERT
  const dynCols = []
    .concat(titleInsert.added ? [_docTitleCol] : [])
    .concat(pubInsert.added ? [_docPublicUrlCol] : [])
    .filter(Boolean);

  const dynVals = [];
  // หมายเหตุ: เรา push values ตามลำดับ: title(ถ้ามี) -> public_url(ถ้ามี) -> fields เดิม
  if (titleInsert.added) dynVals.push(`$1`);
  if (pubInsert.added) dynVals.push(`$${titleInsert.added ? 2 : 1}`);

  const sql = `
    INSERT INTO documents (
      ${dynCols.length ? `${dynCols.join(", ")},` : ""}
      original_file_name,
      stored_file_name,
      file_path,
      file_size,
      mime_type,
      folder_id,
      document_type_id,
      it_job_type_id,
      created_by
    )
    VALUES (
      ${dynVals.length ? `${dynVals.join(", ")},` : ""}
      $${p1}, $${p2}, $${p3}, $${p4}, $${p5}, $${p6}, $${p7}, $${p8}, $${p9}
    )
    RETURNING
      document_id,
      ${titleReturnFrag}
      ${pubReturnFrag}
      original_file_name,
      stored_file_name,
      file_path,
      file_size,
      mime_type,
      folder_id,
      document_type_id,
      it_job_type_id,
      created_by,
      created_at,
      deleted_at,
      deleted_by;
  `;

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

// =========================
// ✅ NEW: rename document title
// =========================
export async function renameDocumentTitle({ id, title }) {
  const docId = Number(id);
  if (!Number.isInteger(docId)) return null;

  await getDocumentsColumns();
  if (!_docTitleCol) return null;

  const sql = `
    UPDATE documents
    SET ${_docTitleCol} = $1,
        updated_at = NOW()
    WHERE document_id = $2
      AND deleted_at IS NULL
    RETURNING
      document_id,
      ${_docTitleCol} AS title,
      original_file_name,
      stored_file_name,
      file_path,
      file_size,
      mime_type,
      folder_id,
      document_type_id,
      it_job_type_id,
      created_by,
      created_at;
  `;

  const { rows, rowCount } = await pool.query(sql, [String(title).trim(), docId]);
  if (!rowCount) return null;
  return rows[0];
}