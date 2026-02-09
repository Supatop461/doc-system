// src/routes/folders.routes.js
console.log("✅ LOADED folders.routes.js");

import { Router } from "express";
import pool from "../db/pool.js";
import { authRequired, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// =========================
// Helpers
// =========================
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

const getNumericUserId = (req) => {
  const raw =
    req.user?.id ??
    req.user?.user_id ??
    req.user?.userId ??
    req.user?.created_by_user_id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

async function getDefaultDocumentTypeId() {
  const r = await pool.query(`
    SELECT document_type_id
    FROM public.document_types
    WHERE deleted_at IS NULL AND (is_active IS NULL OR is_active = true)
    ORDER BY document_type_id ASC
    LIMIT 1
  `);
  return r.rows[0]?.document_type_id ?? null;
}

async function getDefaultItJobTypeId() {
  const r = await pool.query(`
    SELECT it_job_type_id
    FROM public.it_job_types
    WHERE deleted_at IS NULL AND (is_active IS NULL OR is_active = true)
    ORDER BY it_job_type_id ASC
    LIMIT 1
  `);
  return r.rows[0]?.it_job_type_id ?? null;
}

async function assertDocTypeExists(id) {
  const r = await pool.query(
    `
    SELECT 1
    FROM public.document_types
    WHERE document_type_id = $1 AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  );
  return r.rowCount > 0;
}

async function assertItJobTypeExists(id) {
  const r = await pool.query(
    `
    SELECT 1
    FROM public.it_job_types
    WHERE it_job_type_id = $1 AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  );
  return r.rowCount > 0;
}

// =========================
// GET /api/folders
// =========================
/**
 * GET /api/folders
 * - /api/folders?all=1   => เอาทั้งหมดสำหรับทำ tree
 * - /api/folders?parent_id=xxx => เอาลูกของ parent
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const { parent_id, all } = req.query;

    // ✅ โหมดเอาทั้งหมด (ใช้ในหน้า tree)
    if (String(all) === "1") {
      const sql = `
        SELECT
          f.folder_id,
          f.name,
          f.parent_id,
          f.document_type_id,
          f.it_job_type_id,
          f.doc_prefix,
          f.description,
          f.created_at,
          f.updated_at,

          dt.name AS document_type_name,
          ij.name AS it_job_type_name
        FROM public.folders f
        LEFT JOIN public.document_types dt
          ON dt.document_type_id = f.document_type_id
        LEFT JOIN public.it_job_types ij
          ON ij.it_job_type_id = f.it_job_type_id
        WHERE f.deleted_at IS NULL
        ORDER BY f.folder_id ASC
      `;
      const { rows } = await pool.query(sql);
      return res.json(rows);
    }

    // ✅ โหมดรายระดับ (parent_id)
    const params = [];
    let whereParent = "f.parent_id IS NULL";

    if (parent_id !== undefined) {
      const pid = parent_id === "" ? null : Number(parent_id);
      if (pid !== null && !Number.isInteger(pid)) {
        return res.status(400).json({ message: "parent_id must be an integer" });
      }
      params.push(pid);
      whereParent = `f.parent_id = $${params.length}`;
    }

    const sql = `
      SELECT
        f.folder_id,
        f.name,
        f.parent_id,
        f.document_type_id,
        f.it_job_type_id,
        f.doc_prefix,
        f.description,
        f.created_at,
        f.updated_at,

        dt.name AS document_type_name,
        ij.name AS it_job_type_name
      FROM public.folders f
      LEFT JOIN public.document_types dt
        ON dt.document_type_id = f.document_type_id
      LEFT JOIN public.it_job_types ij
        ON ij.it_job_type_id = f.it_job_type_id
      WHERE ${whereParent}
        AND f.deleted_at IS NULL
      ORDER BY f.folder_id ASC
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/folders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// POST /api/folders (✅ user สร้างได้)
// FIX: กัน document_type_id / it_job_type_id เป็น NULL
// - ถ้ามี parent_id: สืบทอดจาก parent เป็นค่าเริ่มต้น
// - ถ้า root: ใช้ default ตัวแรกที่ active (fallback: 1)
// =========================
router.post("/", authRequired, async (req, res) => {
  try {
    const {
      name,
      parent_id = null,
      document_type_id = null,
      it_job_type_id = null,
      doc_prefix = null,
      description = null,
    } = req.body || {};

    const created_by = getNumericUserId(req);

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "ต้องมีชื่อแฟ้ม" });
    }
    if (!created_by) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pid = toIntOrNull(parent_id);
    if (Number.isNaN(pid)) {
      return res.status(400).json({ message: "parent_id must be an integer or null" });
    }

    let dtid = toIntOrNull(document_type_id);
    if (Number.isNaN(dtid)) {
      return res.status(400).json({ message: "document_type_id must be an integer or null" });
    }

    let itid = toIntOrNull(it_job_type_id);
    if (Number.isNaN(itid)) {
      return res.status(400).json({ message: "it_job_type_id must be an integer or null" });
    }

    const prefix =
      doc_prefix === undefined || doc_prefix === null ? null : String(doc_prefix).trim() || null;

    const desc =
      description === undefined || description === null ? null : String(description).trim() || null;

    // ✅ ถ้ามี parent_id และไม่ได้ส่ง dt/it มา -> สืบทอดจาก parent
    if (pid !== null && (dtid === null || itid === null)) {
      const pr = await pool.query(
        `
        SELECT folder_id, document_type_id, it_job_type_id
        FROM public.folders
        WHERE folder_id = $1 AND deleted_at IS NULL
        LIMIT 1
        `,
        [pid]
      );

      if (pr.rowCount === 0) {
        return res.status(404).json({ message: "Parent folder not found" });
      }

      const parent = pr.rows[0];

      if (dtid === null) dtid = parent.document_type_id ?? null;
      if (itid === null) itid = parent.it_job_type_id ?? null;

      // ถ้า parent ยังว่างจริง ๆ ให้บังคับไปตั้งค่าที่ parent ก่อน
      if (!dtid) {
        return res.status(400).json({
          message: "PARENT_DOCUMENT_TYPE_MISSING",
          detail: "แฟ้มแม่ยังไม่มีประเภทเอกสาร (document_type_id) กรุณาตั้งค่าแฟ้มแม่ก่อน",
        });
      }
      if (!itid) {
        return res.status(400).json({
          message: "PARENT_IT_JOB_TYPE_MISSING",
          detail: "แฟ้มแม่ยังไม่มีงาน IT (it_job_type_id) กรุณาตั้งค่าแฟ้มแม่ก่อน",
        });
      }
    }

    // ✅ ถ้าเป็น root แล้วยังไม่มีค่า -> ใส่ default ให้อัตโนมัติ
    if (pid === null && !dtid) dtid = (await getDefaultDocumentTypeId()) ?? 1;
    if (pid === null && !itid) itid = (await getDefaultItJobTypeId()) ?? 1;

    // ✅ validate FK มีอยู่จริง (กันใส่มั่ว)
    if (dtid && !(await assertDocTypeExists(dtid))) {
      return res.status(404).json({ message: "document type not found" });
    }
    if (itid && !(await assertItJobTypeExists(itid))) {
      return res.status(404).json({ message: "it job type not found" });
    }

    const sql = `
      INSERT INTO folders
        (name, parent_id, document_type_id, it_job_type_id, doc_prefix, description, created_by)
      VALUES
        ($1,   $2,        $3,               $4,            $5,        $6,         $7)
      RETURNING
        folder_id, name, parent_id, document_type_id, it_job_type_id, doc_prefix, description,
        created_by, created_at, updated_at
    `;

    const params = [name.trim(), pid, dtid, itid, prefix, desc, created_by];
    const result = await pool.query(sql, params);

    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("POST /folders error:", err);

    // ✅ ถ้าเป็น error จาก trigger (เช่น depth max3 เก่า)
    if (err?.code === "P0001") {
      return res.status(400).json({ message: err?.message || "ไม่สามารถสร้างแฟ้มได้" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// =========================
// PATCH /api/folders/:id (admin เท่านั้น)
// =========================
router.patch("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "id must be an integer" });
    }

    const exists = await pool.query(
      `SELECT folder_id FROM folders WHERE folder_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (exists.rowCount === 0) {
      return res.status(404).json({ message: "Folder not found" });
    }

    const body = req.body || {};

    const name =
      body.name === undefined || body.name === null ? undefined : String(body.name).trim();
    if (name !== undefined && !name) {
      return res.status(400).json({ message: "ต้องมีชื่อแฟ้ม" });
    }

    const dtid = body.document_type_id === undefined ? undefined : toIntOrNull(body.document_type_id);
    if (dtid !== undefined && Number.isNaN(dtid)) {
      return res.status(400).json({ message: "document_type_id must be an integer or null" });
    }

    const itid = body.it_job_type_id === undefined ? undefined : toIntOrNull(body.it_job_type_id);
    if (itid !== undefined && Number.isNaN(itid)) {
      return res.status(400).json({ message: "it_job_type_id must be an integer or null" });
    }

    const prefix =
      body.doc_prefix === undefined ? undefined : String(body.doc_prefix ?? "").trim() || null;

    const desc =
      body.description === undefined ? undefined : String(body.description ?? "").trim() || null;

    // validate FK if provided (not undefined)
    if (dtid !== undefined && dtid !== null && !(await assertDocTypeExists(dtid))) {
      return res.status(404).json({ message: "document type not found" });
    }
    if (itid !== undefined && itid !== null && !(await assertItJobTypeExists(itid))) {
      return res.status(404).json({ message: "it job type not found" });
    }

    // build dynamic update
    const sets = [];
    const params = [];
    const pushSet = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (name !== undefined) pushSet("name", name);
    if (dtid !== undefined) pushSet("document_type_id", dtid);
    if (itid !== undefined) pushSet("it_job_type_id", itid);
    if (prefix !== undefined) pushSet("doc_prefix", prefix);
    if (desc !== undefined) pushSet("description", desc);

    if (!sets.length) {
      return res.status(400).json({ message: "NO_FIELDS_TO_UPDATE" });
    }

    params.push(id);

    const sql = `
      UPDATE folders
      SET ${sets.join(", ")},
          updated_at = NOW()
      WHERE folder_id = $${params.length}
        AND deleted_at IS NULL
      RETURNING
        folder_id, name, parent_id, document_type_id, it_job_type_id, doc_prefix, description,
        created_by, created_at, updated_at
    `;

    const r = await pool.query(sql, params);
    return res.json({ data: r.rows[0] });
  } catch (err) {
    console.error("PATCH /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * DELETE /api/folders/:id (admin เท่านั้น)
 * Policy: ลบได้เฉพาะ "แฟ้มว่าง"
 */
router.delete("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "id must be an integer" });
    }

    const exists = await pool.query(
      `SELECT folder_id, name FROM folders WHERE folder_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (exists.rowCount === 0) {
      return res.status(404).json({ message: "Folder not found" });
    }

    const child = await pool.query(
      `SELECT 1 FROM folders WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (child.rowCount > 0) {
      return res.status(400).json({
        message: "DELETE_FOLDER_NOT_EMPTY",
        detail: "ไม่สามารถลบแฟ้มได้: ยังมีแฟ้มย่อยอยู่ (ต้องลบแฟ้มย่อยให้หมดก่อน)",
      });
    }

    const docs = await pool.query(
      `
      WITH RECURSIVE tree AS (
        SELECT folder_id
        FROM folders
        WHERE folder_id = $1
        UNION ALL
        SELECT f.folder_id
        FROM folders f
        JOIN tree t ON f.parent_id = t.folder_id
      )
      SELECT 1
      FROM documents d
      WHERE d.deleted_at IS NULL
        AND d.folder_id IN (SELECT folder_id FROM tree)
      LIMIT 1
      `,
      [id]
    );

    if (docs.rowCount > 0) {
      return res.status(400).json({
        message: "DELETE_FOLDER_NOT_EMPTY",
        detail:
          "ไม่สามารถลบแฟ้มได้: พบเอกสารอยู่ในแฟ้มนี้หรือแฟ้มย่อยด้านใน (ต้องลบ/ย้ายเอกสารออกก่อน)",
      });
    }

    const result = await pool.query(
      `
      UPDATE folders
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE folder_id = $1 AND deleted_at IS NULL
      RETURNING folder_id, name, deleted_at
      `,
      [id]
    );

    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("DELETE /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;