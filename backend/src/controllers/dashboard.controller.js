import pool from "../db/pool.js";

export const getDashboardSummary = async (req, res) => {
  try {
    // ======================
    // KPI
    // ======================
    const qDocs = pool.query(`
      SELECT COUNT(*)::int AS count
      FROM public.documents
      WHERE deleted_at IS NULL
    `);

    const qFolders = pool.query(`
      SELECT COUNT(*)::int AS count
      FROM public.folders
      WHERE deleted_at IS NULL
    `);

    const qFiles = pool.query(`
      SELECT COUNT(*)::int AS count
      FROM public.documents
      WHERE deleted_at IS NULL
        AND original_file_name IS NOT NULL
    `);

    // ======================
    // เอกสารล่าสุด (ไม่ใช้ view แล้ว)
    // ======================
    const qLatest = pool.query(`
      SELECT
        d.document_id,
        d.folder_id,
        f.name AS folder_name,
        dt.name AS document_type_name,
        d.original_file_name,
        d.file_size,
        d.mime_type,
        d.created_at,
        d.created_by,
        u.username AS created_by_username
      FROM public.documents d
      LEFT JOIN public.folders f
        ON f.folder_id = d.folder_id
      LEFT JOIN public.document_types dt
        ON dt.document_type_id = d.document_type_id
      LEFT JOIN public.users u
        ON u.user_id = d.created_by
      WHERE d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT 5
    `);

    const [docsR, foldersR, filesR, latestR] = await Promise.all([
      qDocs,
      qFolders,
      qFiles,
      qLatest,
    ]);

    const documents = docsR.rows?.[0]?.count ?? 0;
    const folders = foldersR.rows?.[0]?.count ?? 0;
    const files = filesR.rows?.[0]?.count ?? 0;

    const latestDocuments = latestR.rows || [];

    const latestActivities = latestDocuments.map((d) => ({
      title: "สร้างเอกสาร",
      doc: String(d.document_id),
      by: d.created_by_username || "unknown",
      when: d.created_at,
    }));

    return res.json({
      kpi: {
        documents,
        folders,
        files,
        viewsToday: 0,
      },
      latestDocuments,
      latestActivities,
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};