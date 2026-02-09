// src/controllers/settings.controller.js
import pool from "../db/pool.js";

function toBool(x) {
  if (x === true || x === false) return x;
  if (x === 1 || x === "1" || String(x).toLowerCase() === "true") return true;
  if (x === 0 || x === "0" || String(x).toLowerCase() === "false") return false;
  return undefined;
}

function mustIntId(req, res) {
  const raw = req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ ok: false, message: "invalid id" });
    return null;
  }
  return id;
}

/* ---------------------------
   Document Types
---------------------------- */

export const listDocumentTypes = async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || "0") === "1";
    const { rows } = await pool.query(
      `
      SELECT document_type_id, name, is_active, created_at, updated_at
      FROM public.document_types
      WHERE deleted_at IS NULL
        AND ($1::boolean = true OR is_active = true)
      ORDER BY name ASC
      `,
      [includeInactive]
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listDocumentTypes error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const createDocumentType = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const is_active = req.body?.is_active === undefined ? true : !!req.body.is_active;
    const userId = req.user?.id;

    if (!name) return res.status(400).json({ ok: false, message: "name is required" });
    if (!userId) return res.status(401).json({ ok: false, message: "unauthorized" });

    const { rows } = await pool.query(
      `
      INSERT INTO public.document_types (name, is_active, created_by)
      VALUES ($1,$2,$3)
      RETURNING document_type_id, name, is_active, created_at, updated_at
      `,
      [name, is_active, userId]
    );

    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, message: "document type already exists" });
    }
    console.error("createDocumentType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const updateDocumentType = async (req, res) => {
  try {
    const id = mustIntId(req, res);
    if (!id) return;

    const nameRaw = req.body?.name;
    const name = nameRaw === undefined ? undefined : String(nameRaw).trim();
    const is_active = toBool(req.body?.is_active);

    if (name !== undefined && !name) return res.status(400).json({ ok: false, message: "name is required" });
    if (name === undefined && is_active === undefined) return res.status(400).json({ ok: false, message: "no fields to update" });

    const sets = [];
    const vals = [];
    if (name !== undefined) { vals.push(name); sets.push(`name = $${vals.length}`); }
    if (is_active !== undefined) { vals.push(is_active); sets.push(`is_active = $${vals.length}`); }
    sets.push(`updated_at = NOW()`);

    vals.push(id);

    const { rows } = await pool.query(
      `
      UPDATE public.document_types
      SET ${sets.join(", ")}
      WHERE document_type_id = $${vals.length} AND deleted_at IS NULL
      RETURNING document_type_id, name, is_active, created_at, updated_at
      `,
      vals
    );

    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, message: "document type already exists" });
    }
    console.error("updateDocumentType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const deleteDocumentType = async (req, res) => {
  try {
    const id = mustIntId(req, res);
    if (!id) return;

    const { rows } = await pool.query(
      `
      UPDATE public.document_types
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE document_type_id = $1 AND deleted_at IS NULL
      RETURNING document_type_id
      `,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteDocumentType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

/* ---------------------------
   IT Job Types
---------------------------- */

export const listItJobTypes = async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || "0") === "1";
    const { rows } = await pool.query(
      `
      SELECT it_job_type_id, name, is_active, created_at, updated_at
      FROM public.it_job_types
      WHERE deleted_at IS NULL
        AND ($1::boolean = true OR is_active = true)
      ORDER BY name ASC
      `,
      [includeInactive]
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listItJobTypes error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const createItJobType = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const is_active = req.body?.is_active === undefined ? true : !!req.body.is_active;
    const userId = req.user?.id;

    if (!name) return res.status(400).json({ ok: false, message: "name is required" });
    if (!userId) return res.status(401).json({ ok: false, message: "unauthorized" });

    const { rows } = await pool.query(
      `
      INSERT INTO public.it_job_types (name, is_active, created_by)
      VALUES ($1,$2,$3)
      RETURNING it_job_type_id, name, is_active, created_at, updated_at
      `,
      [name, is_active, userId]
    );

    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, message: "it job type already exists" });
    }
    console.error("createItJobType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const updateItJobType = async (req, res) => {
  try {
    const id = mustIntId(req, res);
    if (!id) return;

    const nameRaw = req.body?.name;
    const name = nameRaw === undefined ? undefined : String(nameRaw).trim();
    const is_active = toBool(req.body?.is_active);

    if (name !== undefined && !name) return res.status(400).json({ ok: false, message: "name is required" });
    if (name === undefined && is_active === undefined) return res.status(400).json({ ok: false, message: "no fields to update" });

    const sets = [];
    const vals = [];
    if (name !== undefined) { vals.push(name); sets.push(`name = $${vals.length}`); }
    if (is_active !== undefined) { vals.push(is_active); sets.push(`is_active = $${vals.length}`); }
    sets.push(`updated_at = NOW()`);

    vals.push(id);

    const { rows } = await pool.query(
      `
      UPDATE public.it_job_types
      SET ${sets.join(", ")}
      WHERE it_job_type_id = $${vals.length} AND deleted_at IS NULL
      RETURNING it_job_type_id, name, is_active, created_at, updated_at
      `,
      vals
    );

    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, message: "it job type already exists" });
    }
    console.error("updateItJobType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const deleteItJobType = async (req, res) => {
  try {
    const id = mustIntId(req, res);
    if (!id) return;

    const { rows } = await pool.query(
      `
      UPDATE public.it_job_types
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE it_job_type_id = $1 AND deleted_at IS NULL
      RETURNING it_job_type_id
      `,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteItJobType error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};