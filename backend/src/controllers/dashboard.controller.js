import pool from "../db/pool.js";

/**
 * GET /dashboard/summary
 * - KPI: documents, folders, files (นับจาก documents ที่มีไฟล์), viewsToday (ยังไม่มี log -> 0)
 * - latestDocuments: จาก v_documents_list (ไม่รวมลบ) + join users เพื่อเอา username
 * - latestActivities: สร้างจากเอกสารล่าสุด (ข้อมูลจริง) แทน activity log ชั่วคราว
 */
export const getDashboardSummary = async (req, res) => {
  try {
    // 1) KPI
    const qDocs = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.documents
       WHERE deleted_at IS NULL`
    );

    const qFolders = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.folders
       WHERE deleted_at IS NULL`
    );

    // ใน schema คุณ "documents" เก็บไฟล์ (original_file_name / file_path / stored_file_name)
    // นับ "files" เป็นจำนวนเอกสารที่มีไฟล์จริง
    const qFiles = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.documents
       WHERE deleted_at IS NULL
         AND (file_path IS NOT NULL OR stored_file_name IS NOT NULL OR original_file_name IS NOT NULL)`
    );

    // 2) เอกสารล่าสุด (อิง view จริง) + เอาชื่อผู้สร้างจาก users
    const qLatest = pool.query(
      `SELECT
          v.document_id,
          v.folder_id,
          v.folder_name,
          v.document_type_name,
          v.original_file_name,
          v.file_size,
          v.mime_type,
          v.created_at,
          v.created_by_user_id,
          u.username AS created_by_username
       FROM public.v_documents_list v
       LEFT JOIN public.users u
         ON u.user_id = v.created_by_user_id
       WHERE v.deleted_at IS NULL
       ORDER BY v.created_at DESC
       LIMIT 5`
    );

    const [docsR, foldersR, filesR, latestR] = await Promise.all([
      qDocs,
      qFolders,
      qFiles,
      qLatest,
    ]);

    const documents = docsR.rows?.[0]?.count ?? 0;
    const folders = foldersR.rows?.[0]?.count ?? 0;
    const files = filesR.rows?.[0]?.count ?? 0;

    const latestDocuments = (latestR.rows || []).map((r) => ({
      document_id: r.document_id,
      folder_id: r.folder_id,
      folder_name: r.folder_name,
      document_type_name: r.document_type_name,
      original_file_name: r.original_file_name,
      file_size: r.file_size,
      mime_type: r.mime_type,
      created_at: r.created_at,
      created_by_user_id: r.created_by_user_id,
      created_by_username: r.created_by_username,
    }));

    // 3) latestActivities (ยังไม่มี activity_log -> ใช้เอกสารล่าสุดแทนแบบข้อมูลจริง)
    const latestActivities = latestDocuments.map((d) => ({
      title: "สร้างเอกสาร",
      doc: String(d.document_id),
      by: d.created_by_username || "unknown",
      when: d.created_at, // ให้ frontend format เอง
    }));

    return res.json({
      kpi: {
        documents,
        folders,
        files,
        viewsToday: 0, // TODO: ถ้ามี activity_log ค่อยนับจริง
      },
      latestDocuments,
      latestActivities,
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
