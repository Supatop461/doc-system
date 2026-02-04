(function () {
  // =========================
  // Upload Modal – Documents
  // =========================

  const apiFetch =
    window.api?.apiFetch ||
    window.apiFetch ||
    (() => {
      throw new Error("apiFetch not found");
    });

  const normalizeItems = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.rows)) return raw.rows;
    return [];
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  // =========================
  // Create modal once
  // =========================
  function ensureUploadModal() {
    if (document.getElementById("docUploadOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "docUploadOverlay";
    overlay.className = "modal-overlay";
    overlay.style.display = "none";

    overlay.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-head">
          <div>
            <div class="modal-title">เพิ่มเอกสารใหม่</div>
            <div class="modal-sub">
              เลือกแฟ้ม • ประเภทเอกสาร • งาน IT • ผู้รับผิดชอบ • แนบไฟล์
            </div>
          </div>
          <button class="modal-close" id="btnUploadClose">✕</button>
        </div>

        <div class="modal-body">
          <div class="modal-grid">
            <div class="full">
              <label>แฟ้มเอกสาร *</label>
              <select id="upFolder"></select>
            </div>

            <div class="full">
              <label>ประเภทเอกสาร *</label>
              <select id="upDocType"></select>
            </div>

            <div class="full">
              <label>งาน IT *</label>
              <select id="upItJob"></select>
            </div>

            <div class="full">
              <label>ผู้รับผิดชอบ *</label>
              <select id="upOwner"></select>
            </div>

            <div class="full">
              <label>แนบไฟล์ *</label>
              <input id="upFile" type="file" />
              <div class="muted">รองรับไฟล์ตามที่ backend กำหนด</div>
            </div>
          </div>

          <div id="uploadError" class="modal-error"></div>

          <div class="modal-actions">
            <button class="btn btn-ghost" id="btnUploadCancel">ยกเลิก</button>
            <button class="btn btn-primary" id="btnUploadSubmit">
              บันทึกเอกสาร
            </button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeUploadModal();
    });

    document.body.appendChild(overlay);

    document
      .getElementById("btnUploadClose")
      .addEventListener("click", closeUploadModal);
    document
      .getElementById("btnUploadCancel")
      .addEventListener("click", closeUploadModal);

    document
      .getElementById("btnUploadSubmit")
      .addEventListener("click", submitUpload);
  }

  function openUploadModal() {
    ensureUploadModal();
    loadAllSelects();
    clearError();
    document.getElementById("docUploadOverlay").style.display = "flex";
  }

  function closeUploadModal() {
    const el = document.getElementById("docUploadOverlay");
    if (el) el.style.display = "none";
  }

  // =========================
  // Load select data
  // =========================
  async function loadAllSelects() {
    await Promise.all([
      loadFolders(),
      loadDocTypes(),
      loadItJobs(),
      loadOwner(),
    ]);
  }

  async function loadFolders() {
    const sel = document.getElementById("upFolder");
    sel.innerHTML = `<option>กำลังโหลด...</option>`;
    const data = await apiFetch("/api/folders");
    const items = normalizeItems(data);
    sel.innerHTML =
      `<option value="">-- เลือกแฟ้ม --</option>` +
      items
        .map(
          (f) =>
            `<option value="${f.folder_id ?? f.id}">
              ${esc(f.name ?? f.folder_name)}
            </option>`
        )
        .join("");
  }

  async function loadDocTypes() {
    const sel = document.getElementById("upDocType");
    sel.innerHTML = `<option>กำลังโหลด...</option>`;
    const data = await apiFetch("/api/document-types");
    const items = normalizeItems(data);
    sel.innerHTML =
      `<option value="">-- เลือกประเภทเอกสาร --</option>` +
      items
        .map(
          (d) =>
            `<option value="${d.document_type_id ?? d.id}">
              ${esc(d.name)}
            </option>`
        )
        .join("");
  }

  async function loadItJobs() {
    const sel = document.getElementById("upItJob");
    sel.innerHTML = `<option>กำลังโหลด...</option>`;
    const data = await apiFetch("/api/it-job-types");
    const items = normalizeItems(data);
    sel.innerHTML =
      `<option value="">-- เลือกงาน IT --</option>` +
      items
        .map(
          (j) =>
            `<option value="${j.it_job_type_id ?? j.id}">
              ${esc(j.name)}
            </option>`
        )
        .join("");
  }

  function loadOwner() {
    const sel = document.getElementById("upOwner");
    const u = getUser();
    const id = u.id ?? u.user_id;
    sel.innerHTML = `<option value="${id}">
      ${esc(u.username ?? "ผู้ใช้งาน")}
    </option>`;
  }

  // =========================
  // Submit
  // =========================
  function clearError() {
    const e = document.getElementById("uploadError");
    if (e) e.textContent = "";
  }

  function showError(msg) {
    const e = document.getElementById("uploadError");
    if (e) e.textContent = msg;
  }

  async function submitUpload() {
    clearError();

    const folder = document.getElementById("upFolder").value;
    const docType = document.getElementById("upDocType").value;
    const itJob = document.getElementById("upItJob").value;
    const owner = document.getElementById("upOwner").value;
    const file = document.getElementById("upFile").files[0];

    if (!folder) return showError("กรุณาเลือกแฟ้มเอกสาร");
    if (!docType) return showError("กรุณาเลือกประเภทเอกสาร");
    if (!itJob) return showError("กรุณาเลือกงาน IT");
    if (!file) return showError("กรุณาแนบไฟล์");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder_id", folder);
    fd.append("document_type_id", docType);
    fd.append("it_job_type_id", itJob);
    fd.append("responsible_user_id", owner);
    fd.append("created_by_user_id", owner);

    try {
      await apiFetch("/api/documents", {
        method: "POST",
        body: fd,
      });

      alert("อัปโหลดสำเร็จ");
      closeUploadModal();
      location.reload();
    } catch (e) {
      showError(e?.message || "อัปโหลดไม่สำเร็จ");
    }
  }

  // =========================
  // Hook from documents.page.js
  // =========================
  document.addEventListener("open-upload-modal", openUploadModal);
})();
