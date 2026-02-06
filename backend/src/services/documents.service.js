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

async function getDocumentsColumns() {
  if (_docColsCache) return _docColsCache;

  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='documents'`
  );

  _docColsCache = new Set(rows.map((r) => r.column_name));

  // เลือกชื่อคอลัมน์ title ที่เป็นไปได้ (คุณจะใช้ชื่อไหนก็ได้)
  const candidates = ["title", "document_title", "doc_title", "document_name", "name"];
  _docTitleCol = candidates.find((c) => _docColsCache.has(c)) || null;

  return _docColsCache;
}

async function getTitleSelectFragment() {
  await getDocumentsColumns();
  if (_docTitleCol) return `d.${_docTitleCol} AS title,`;
  // ถ้าไม่มีคอลัมน์ title ใน DB ให้ส่ง title เป็น null (กัน frontend งง)
  return `NULL AS title,`;
}

async function getTitleInsertColsAndParams(values) {
  await getDocumentsColumns();
  if (!_docTitleCol) return { cols: "", vals: "", added: false };

  // เพิ่มคอลัมน์ title เข้า insert แบบ dynamic
  values.push(null); // placeholder ก่อน เดี๋ยว setter จะ set จริง
  const idx = values.length;
  return {
    cols: `, ${_docTitleCol}`,
    vals: `, $${idx}`,
    added: true,
    idx,
  };
}

/**
 * ใช้กับ GET /api/documents?folder_id=...  (ขั้นต่ำ STEP 9)
 * - ดึงเฉพาะในแฟ้ม
 * - ไม่รวมที่ถูกลบ (deleted_at IS NULL)
 */
export async function listDocumentsByFolder(folderId, { limit = 100, offset = 0 } = {}) {
  const folder_id = toInt(folderId, null);
  if (folder_id === null) return [];

  const titleFrag = await getTitleSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      -- ✅ NEW: ให้ list เห็นค่าที่บันทึกจาก settings
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

  const titleFrag = await getTitleSelectFragment();

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      -- ✅ NEW
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

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      -- ✅ NEW
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

  const sql = `
    SELECT
      d.document_id,
      ${titleFrag}
      d.original_file_name,
      d.stored_file_name,
      d.file_path,
      d.file_size,
      d.mime_type,
      d.folder_id,

      -- ✅ NEW
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

export async function createDocument({
  // ✅ NEW (optional): ชื่อเอกสารที่แก้ได้
  title,

  original_file_name,
  stored_file_name,
  file_path,
  file_size,
  mime_type,
  folder_id,
  document_type_id, // ✅ NEW
  it_job_type_id,   // ✅ NEW
  created_by,
}) {
  const values = [];

  // เตรียม insert title แบบ dynamic (ถ้ามีคอลัมน์จริงใน DB)
  const titleInsert = await getTitleInsertColsAndParams(values);

  // ใส่ค่าจริงของ title ถ้าใช้ได้
  if (titleInsert.added) {
    values[titleInsert.idx - 1] = (String(title ?? "").trim() || null);
  }

  // ต่อด้วยฟิลด์เดิมทั้งหมด (กันพัง)
  values.push(original_file_name);
  values.push(stored_file_name);
  values.push(file_path);
  values.push(file_size != null ? Number(file_size) : null);
  values.push(mime_type);
  values.push(toInt(folder_id, null));
  values.push(toInt(document_type_id, null));
  values.push(toInt(it_job_type_id, null));
  values.push(created_by);

  // ตำแหน่งพารามิเตอร์ (ถ้ามี title จะเลื่อนไป +1)
  const base = titleInsert.added ? 1 : 0;
  const p1 = 1 + base;
  const p2 = 2 + base;
  const p3 = 3 + base;
  const p4 = 4 + base;
  const p5 = 5 + base;
  const p6 = 6 + base;
  const p7 = 7 + base;
  const p8 = 8 + base;
  const p9 = 9 + base;

  const titleReturnFrag = (await (async () => {
    await getDocumentsColumns();
    return _docTitleCol ? `${_docTitleCol} AS title,` : `NULL AS title,`;
  })());

  const sql = `
    INSERT INTO documents (
      ${titleInsert.added ? `${_docTitleCol},` : ""}
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
      ${titleInsert.added ? `$1,` : ""}
      $${p1}, $${p2}, $${p3}, $${p4}, $${p5}, $${p6}, $${p7}, $${p8}, $${p9}
    )
    RETURNING
      document_id,
      ${titleReturnFrag}
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

  // ตรวจว่ามีคอลัมน์ title จริง (คุณมีระบบ cache อยู่แล้ว)
  await getDocumentsColumns();
  if (!_docTitleCol) {
    // ไม่มีคอลัมน์ title ใน DB
    return null;
  }

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

  const { rows, rowCount } = await pool.query(sql, [
    String(title).trim(),
    docId,
  ]);

  if (!rowCount) return null;
  return rows[0];
}