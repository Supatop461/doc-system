console.log("✅ LOADED folders.routes.js");

import { Router } from "express";
import pool from "../db/pool.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";

const router = Router();

/**
 * GET /api/folders
 * GET /api/folders?parent_id=xxx
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { parent_id } = req.query;

    const params = [];
    let whereParent = "parent_id IS NULL";

    // parent_id = undefined => root
    // parent_id = "123" => children of 123
    if (parent_id !== undefined) {
      const pid = parent_id === "" ? null : Number(parent_id);
      if (!Number.isInteger(pid)) {
        return res.status(400).json({ message: "parent_id must be an integer" });
      }
      params.push(pid);
      whereParent = `parent_id = $${params.length}`;
    }

    const sql = `
      SELECT folder_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE ${whereParent}
        AND deleted_at IS NULL
      ORDER BY name ASC
    `;

    const result = await pool.query(sql, params);
    return res.json({ data: result.rows });
  } catch (err) {
    console.error("GET /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /api/folders (admin เท่านั้น)
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, parent_id = null } = req.body || {};

    // ✅ รองรับทั้ง req.user.id และ req.user.user_id กันพัง
    const created_by = req.user?.id ?? req.user?.user_id ?? null;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }
    if (created_by === null) {
      return res.status(401).json({ message: "unauthorized" });
    }

    const pid = parent_id === null ? null : Number(parent_id);
    if (pid !== null && !Number.isInteger(pid)) {
      return res.status(400).json({ message: "parent_id must be an integer or null" });
    }

    const sql = `
      INSERT INTO folders (name, parent_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING folder_id, name, parent_id, created_by, created_at, updated_at
    `;

    const params = [name.trim(), pid, created_by];
    const result = await pool.query(sql, params);

    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("POST /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * DELETE /api/folders/:id (admin เท่านั้น)
 * Soft delete -> ย้ายไปถังขยะ (ตั้ง deleted_at)
 */
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "id must be an integer" });
    }

    const sql = `
      UPDATE folders
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE folder_id = $1 AND deleted_at IS NULL
      RETURNING folder_id, name, deleted_at
    `;

    const result = await pool.query(sql, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Folder not found" });
    }

    return res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("DELETE /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
