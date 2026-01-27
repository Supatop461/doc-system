// src/routes/trash.routes.js
import express from "express";
import pool from "../db/pool.js";

import fs from "fs/promises";
import path from "path";

import { authRequired, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// helper: ตรวจ document_id แบบเบา ๆ (รองรับทั้งเลขและ uuid)
function isValidId(id) {
  if (!id) return false;
  if (/^\d+$/.test(id)) return true; // integer
  if (/^[0-9a-fA-F-]{10,}$/.test(id)) return true; // uuid-ish
  return false;
}

/**
 * GET /api/trash
 * list documents in trash
 * ✅ admin only
 */
router.get("/", authRequired, requireAdmin, async (req, res) => {
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
    console.error("TRASH LIST error:", err);
    res.status(500).json({ message: "TRASH_LIST_FAILED" });
  }
});

/**
 * PATCH /api/trash/:document_id/restore
 * ✅ admin only
 */
router.patch("/:document_id/restore", authRequired, requireAdmin, async (req, res) => {
  try {
    const { document_id } = req.params;

    if (!isValidId(document_id)) {
      return res.status(400).json({ message: "INVALID_DOCUMENT_ID" });
    }

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
    console.error("TRASH RESTORE error:", err);
    res.status(500).json({ message: "TRASH_RESTORE_FAILED" });
  }
});

/**
 * DELETE /api/trash/:document_id
 * permanently delete (admin only) + delete file on disk
 */
router.delete("/:document_id", authRequired, requireAdmin, async (req, res) => {
  const { document_id } = req.params;

  if (!isValidId(document_id)) {
    return res.status(400).json({ message: "INVALID_DOCUMENT_ID" });
  }

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

    // 3) ลบไฟล์จริง (หลัง commit) + กันลบไฟล์นอก uploads
    if (filePath) {
      const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOAD_PATH || "uploads");

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      const rel = path.relative(uploadsRoot, absPath);
      const safeToDelete = !(rel.startsWith("..") || path.isAbsolute(rel));

      if (safeToDelete) {
        try {
          await fs.unlink(absPath);
        } catch {
          // ไฟล์อาจถูกลบไปแล้ว ไม่ถือว่า error
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("TRASH DELETE error:", err);
    res.status(500).json({ message: "TRASH_DELETE_FAILED" });
  } finally {
    client.release();
  }
});

export default router;
