console.log("✅ LOADED folders.routes.js");
import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

/**
 * GET /folders
 * GET /folders?parent_id=xxx
 */
router.get("/", async (req, res) => {
  try {
    const { parent_id } = req.query;

    const params = [];
    let whereParent = "parent_id IS NULL";

    if (parent_id !== undefined) {
      params.push(parent_id);
      whereParent = `parent_id = $${params.length}`;
    }

    const sql = `
  SELECT
    folder_id,
    name,
    parent_id,
    created_at,
    updated_at
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

// POST /folders
// body: { "name": "แฟ้มใหม่", "parent_id": null หรือ 123, "created_by": 1 }
router.post("/", async (req, res) => {
  try {
    const { name, parent_id = null, created_by } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }
    if (!created_by) {
      return res.status(400).json({ message: "created_by is required" });
    }

    const sql = `
      INSERT INTO folders (name, parent_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING folder_id, name, parent_id, created_by, created_at, updated_at
    `;
    const params = [name.trim(), parent_id, created_by];

    const result = await pool.query(sql, params);
    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error("POST /folders error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/", (req, res) => {
  console.log("🔥 POST /folders HIT 🔥", req.body);
  return res.status(201).json({ ok: true, body: req.body });
});

export default router;
