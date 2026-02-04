// src/routes/trash.routes.js
import express from "express";
import pool from "../db/pool.js";
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
 * ✅ admin only (ถ้าจะให้ user เห็นด้วย เอา requireAdmin ออก)
 */
router.get("/", authRequired, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        -- ✅ alias ให้ frontend ใช้ง่าย
        document_id AS id,
        original_file_name AS name,
        mime_type AS type,
        deleted_at AS updated_at,

        -- ✅ fields เดิม (คงไว้ครบ)
        document_id,
        original_file_name,
        stored_file_name,
        file_path,
        file_size,
        mime_type,
        folder_id,
        created_by,
        created_at,
        updated_at AS updated_at_orig,
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

    // ✅ คงรูปแบบเดิมของคุณ: { items: [...] }
    res.json({ items: rows });
  } catch (err) {
    console.error("TRASH LIST error:", err);
    res.status(500).json({ message: "TRASH_LIST_FAILED" });
  }
});

// ===== restore handler (ใช้ร่วมกัน) =====
async function restoreHandler(req, res) {
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
    return res.json({ ok: true });
  } catch (err) {
    console.error("TRASH RESTORE error:", err);
    return res.status(500).json({ message: "TRASH_RESTORE_FAILED" });
  }
}

/**
 * ✅ POST /api/trash/:document_id/restore
 */
router.post("/:document_id/restore", authRequired, requireAdmin, restoreHandler);

/**
 * ✅ PATCH /api/trash/:document_id/restore
 */
router.patch("/:document_id/restore", authRequired, requireAdmin, restoreHandler);

/**
 * ❌ ตัดลบถาวรออกทั้งหมด
 * - เดิมมี:
 *   DELETE /api/trash/:document_id
 *   DELETE /api/trash  (ล้างถัง)
 * - ตอนนี้ "ไม่รองรับ" แล้ว เพื่อความปลอดภัย
 */
router.delete("/:document_id", authRequired, requireAdmin, (_req, res) => {
  return res.status(405).json({
    message: "PERMANENT_DELETE_DISABLED",
  });
});

router.delete("/", authRequired, requireAdmin, (_req, res) => {
  return res.status(405).json({
    message: "EMPTY_TRASH_DISABLED",
  });
});

export default router;
