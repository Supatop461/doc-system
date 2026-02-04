// src/controllers/settings.controller.js
import pool from "../db/pool.js";

/* ---------------------------
   Document Types
---------------------------- */

export const listDocumentTypes = async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || "0") === "1";

    const sql = `
      SELECT
        document_type_id,
        name,
        is_active,
        created_at,
        updated_at
      FROM public.document_types
      WHERE deleted_at IS NULL
        AND (${includeInactive} = true OR is_active = true)
      ORDER BY name ASC
    `;

    const { rows } = await pool.query(sql);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listDocumentTypes error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const createDocumentType = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const is_active =
      req.body?.is_active === undefined ? true : !!req.body.is_active;

    const userId = req.user?.id; // ✅ สำคัญมาก

    if (!name) {
      return res.status(400).json({ ok: false, message: "name is required" });
    }

    if (!userId) {
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }

    const sql = `
      INSERT INTO public.document_types
        (name, is_active, created_by)
      VALUES
        ($1, $2, $3)
      RETURNING
        document_type_id, name, is_active, created_at, updated_at
    `;

    const { rows } = await pool.query(sql, [name, is_active, userId]);
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res
        .status(409)
        .json({ ok: false, message: "document type already exists" });
    }

    console.error("createDocumentType error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/* ---------------------------
   IT Job Types
---------------------------- */

export const listItJobTypes = async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || "0") === "1";

    const sql = `
      SELECT
        it_job_type_id,
        name,
        is_active,
        created_at,
        updated_at
      FROM public.it_job_types
      WHERE deleted_at IS NULL
        AND (${includeInactive} = true OR is_active = true)
      ORDER BY name ASC
    `;

    const { rows } = await pool.query(sql);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listItJobTypes error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};

export const createItJobType = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const is_active =
      req.body?.is_active === undefined ? true : !!req.body.is_active;

    const userId = req.user?.id; // ✅ สำคัญมาก

    if (!name) {
      return res.status(400).json({ ok: false, message: "name is required" });
    }

    if (!userId) {
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }

    const sql = `
      INSERT INTO public.it_job_types
        (name, is_active, created_by)
      VALUES
        ($1, $2, $3)
      RETURNING
        it_job_type_id, name, is_active, created_at, updated_at
    `;

    const { rows } = await pool.query(sql, [name, is_active, userId]);
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.code === "23505") {
      return res
        .status(409)
        .json({ ok: false, message: "it job type already exists" });
    }

    console.error("createItJobType error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
};
