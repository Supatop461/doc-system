// src/jobs/trashPurge.job.js
import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import pool from "../db/pool.js";

async function purgeOnce() {
  const days = Number(process.env.TRASH_PURGE_DAYS || 30);

  const { rows } = await pool.query(
    `
    SELECT document_id, file_path
    FROM documents
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - ($1 || ' days')::interval
    ORDER BY deleted_at ASC
    LIMIT 200
    `,
    [String(days)]
  );

  if (!rows.length) return;

  const ids = rows.map((r) => Number(r.document_id)).filter(Number.isFinite);

  // ✅ ลบ record ด้วย document_id (int)
  await pool.query(`DELETE FROM documents WHERE document_id = ANY($1::int[])`, [ids]);

  // ✅ ลบไฟล์จริง
  for (const r of rows) {
    if (!r.file_path) continue;

    const absPath = path.isAbsolute(r.file_path)
      ? r.file_path
      : path.resolve(process.cwd(), r.file_path);

    try {
      await fs.unlink(absPath);
    } catch {}
  }

  console.log(`🧹 Purged ${rows.length} docs older than ${days} days`);
}

export function startTrashPurgeJob() {
  // ทุกวันตี 3
  cron.schedule("0 3 * * *", () => purgeOnce().catch(console.error));
}

export { purgeOnce }; // ✅ เผื่อทดสอบแบบรันทันที
