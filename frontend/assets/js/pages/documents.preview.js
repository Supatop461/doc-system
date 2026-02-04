(function () {
  // =========================
  // Documents Preview Helper
  // =========================

  const apiFetch =
    window.api?.apiFetch ||
    window.apiFetch ||
    (() => {
      throw new Error("apiFetch not found");
    });

  // =========================
  // Utils
  // =========================
  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const getToken = () =>
    localStorage.getItem("token") ||
    window.api?.getToken?.() ||
    "";

  async function fetchBlobWithAuth(url) {
    const token = getToken();
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `โหลดไฟล์ไม่สำเร็จ (${res.status})`);
    }

    return res.blob();
  }

  // =========================
  // Render preview
  // =========================
  function renderPreview(blob, mime, boxEl) {
    // clear old object url
    const old = boxEl.dataset.objectUrl;
    if (old) {
      try {
        URL.revokeObjectURL(old);
      } catch {}
    }

    const url = URL.createObjectURL(blob);
    boxEl.dataset.objectUrl = url;

    const safeMime = mime || blob.type || "";

    // PDF
    if (safeMime.includes("pdf")) {
      boxEl.innerHTML = `
        <div class="muted" style="margin-bottom:8px;">
          พรีวิวไฟล์ (PDF)
        </div>
        <iframe
          src="${url}"
          style="
            width:100%;
            height:520px;
            border:1px solid rgba(120,0,70,.15);
            border-radius:12px;
            background:#fff;
          ">
        </iframe>
      `;
      return;
    }

    // Image
    if (safeMime.startsWith("image/")) {
      boxEl.innerHTML = `
        <div class="muted" style="margin-bottom:8px;">
          พรีวิวไฟล์ (รูปภาพ)
        </div>
        <img
          src="${url}"
          alt="preview"
          style="
            max-width:100%;
            border:1px solid rgba(120,0,70,.15);
            border-radius:12px;
          "
        />
      `;
      return;
    }

    // Other files
    boxEl.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">
        ไฟล์ประเภทนี้ไม่รองรับพรีวิว
      </div>
      <a
        class="btn btn-primary"
        href="${url}"
        download
        style="display:inline-block;text-decoration:none;">
        ดาวน์โหลดไฟล์
      </a>
    `;
  }

  // =========================
  // Public API (ใช้จาก page)
  // =========================
  async function openPreview({
    documentId,
    mimeType,
    containerId = "previewBox",
  }) {
    const box = document.getElementById(containerId);
    if (!box) return;

    box.innerHTML = `<div class="muted">กำลังโหลดพรีวิว...</div>`;

    try {
      const blob = await fetchBlobWithAuth(
        `/api/documents/${encodeURIComponent(documentId)}/download`
      );
      renderPreview(blob, mimeType, box);
    } catch (e) {
      box.innerHTML = `
        <div style="color:#d62828;font-weight:700;">
          ${esc(e?.message || "พรีวิวไม่สำเร็จ")}
        </div>
      `;
    }
  }

  // =========================
  // Download helper
  // =========================
  async function downloadFile({ documentId, fileName }) {
    try {
      const blob = await fetchBlobWithAuth(
        `/api/documents/${encodeURIComponent(documentId)}/download`
      );
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `document-${documentId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(e?.message || "ดาวน์โหลดไม่สำเร็จ");
    }
  }

  // =========================
  // Expose to window
  // =========================
  window.documentsPreview = {
    openPreview,
    downloadFile,
  };
})();
