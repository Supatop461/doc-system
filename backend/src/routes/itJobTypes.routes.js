import { Router } from "express";
import pool from "../db/pool.js";
import { authRequired } from "../middlewares/auth.js";

const router = Router();

// GET /api/it-job-types
router.get("/", authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT it_job_type_id, name
     FROM public.it_job_types
     WHERE deleted_at IS NULL AND is_active = true
     ORDER BY name ASC`
  );
  res.json(rows);
});

export default router;
