// src/routes/trash.routes.js
import express from "express";
import pool from "../db/pool.js";

import fs from "fs/promises";
import path from "path";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

/**
 * GET /api/trash
 * list documents in trash
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        document_id,
        original_file_name,
        stored_file_name,
        file_path,
        file_size,
        mime_type,
        folder_id,
        created_by,
        created_at,
        updated_at,
        deleted_at,
        deleted_by,
        document_type_id,
        it_job_type_id,
        created_by_user_id
      FROM documents
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      `
    );

    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "TRASH_LIST_FAILED" });
  }
});

/**
 * PATCH /api/trash/:document_id/restore
 */
router.patch("/:document_id/restore", authMiddleware, async (req, res) => {
  try {
    const { document_id } = req.params;

    const { rowCount } = await pool.query(
      `
      UPDATE documents
      SET deleted_at = NULL,
          deleted_by = NULL,
          updated_at = NOW()
      WHERE document_id = $1
        AND deleted_at IS NOT NULL
      `,
      [document_id]
    );

    if (!rowCount) return res.status(404).json({ message: "NOT_FOUND_IN_TRASH" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "TRASH_RESTORE_FAILED" });
  }
});

/**
 * DELETE /api/trash/:document_id
 * permanently delete (admin only) + delete file on disk
 */
router.delete("/:document_id", authMiddleware, requireAdmin, async (req, res) => {
  const { document_id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) หา doc ใน trash
    const found = await client.query(
      `
      SELECT document_id, file_path
      FROM documents
      WHERE document_id = $1
        AND deleted_at IS NOT NULL
      `,
      [document_id]
    );

    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "NOT_FOUND_IN_TRASH" });
    }

    const filePath = found.rows[0].file_path;

    // 2) ลบ record
    await client.query(`DELETE FROM documents WHERE document_id = $1`, [document_id]);

    await client.query("COMMIT");

    // 3) ลบไฟล์จริง (หลัง commit)
    if (filePath) {
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      try {
        await fs.unlink(absPath);
      } catch {
        // ไฟล์อาจถูกลบไปแล้ว ไม่ถือว่า error
      }
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "TRASH_DELETE_FAILED" });
  } finally {
    client.release();
  }
});

export default router;
