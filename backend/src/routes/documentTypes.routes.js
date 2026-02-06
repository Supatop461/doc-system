import { Router } from "express";
import pool from "../db/pool.js";
import { authRequired } from "../middlewares/auth.js";

const router = Router();

// GET /api/document-types
router.get("/", authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT document_type_id, name
     FROM public.document_types
     WHERE deleted_at IS NULL AND is_active = true
     ORDER BY name ASC`
  );
  res.json(rows);
});

export default router;
