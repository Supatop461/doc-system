// frontend/assets/js/modals/documents-upload.modal.js
(function () {
  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const filenameToTitle = (name) => {
    const s = String(name || "");
    const i = s.lastIndexOf(".");
    return i > 0 ? s.slice(0, i) : s;
  };

  const ensureModal = () => {
    let overlay = document.getElementById("uploadModalOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "uploadModalOverlay";
    overlay.className = "upload-modal-overlay";
    overlay.style.display = "none";
    overlay.innerHTML = `
      <div class="upload-modal">
        <div class="upload-modal__head">
          <div class="upload-modal__title">อัปโหลดเอกสาร (หลายไฟล์)</div>
          <button class="btn btn-ghost upload-modal__close" id="uploadModalClose" type="button">✕</button>
        </div>

        <div class="upload-modal__body">
          <div class="upload-modal__row">
            <div class="upload-modal__hint">
              เลือกได้หลายไฟล์ 30–50 ไฟล์ • ชื่อเอกสารจะดึงจากชื่อไฟล์เดิม และแก้ได้
            </div>
            <div class="upload-modal__actions">
              <button class="btn btn-primary" id="btnPickFiles" type="button">เลือกไฟล์</button>
              <button class="btn btn-ghost" id="btnClearFiles" type="button">ล้างรายการ</button>
            </div>
          </div>

          <div class="upload-modal__progress" id="uploadProgress" style="display:none;">
            <div class="upload-progress__bar"><div class="upload-progress__fill" id="uploadProgressFill"></div></div>
            <div class="upload-progress__text" id="uploadProgressText"></div>
          </div>

          <div class="upload-modal__listWrap">
            <div class="upload-modal__listHead">
              <div>ไฟล์</div>
              <div>ชื่อเอกสาร (แก้ได้)</div>
              <div>สถานะ</div>
              <div></div>
            </div>
            <div id="uploadList" class="upload-modal__list">
              <div class="muted" style="padding:12px;">ยังไม่ได้เลือกไฟล์</div>
            </div>
          </div>

          <div id="uploadError" class="upload-modal__error" style="display:none;"></div>
        </div>

        <div class="upload-modal__foot">
          <button class="btn btn-ghost" id="btnUploadCancel" type="button">ยกเลิก</button>
          <button class="btn btn-primary" id="btnUploadDo" type="button">อัปโหลด</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => (overlay.style.display = "none");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#uploadModalClose").addEventListener("click", close);
    overlay.querySelector("#btnUploadCancel").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    return overlay;
  };

  let current = { folder_id: null, files: [] }; // files: Array<{file, title, status, error?}>
  let isUploading = false;

  const render = () => {
    const overlay = ensureModal();
    const list = overlay.querySelector("#uploadList");

    if (!current.files.length) {
      list.innerHTML = `<div class="muted" style="padding:12px;">ยังไม่ได้เลือกไฟล์</div>`;
      return;
    }

    list.innerHTML = current.files
      .map((x, idx) => {
        const f = x.file;
        const safeName = esc(f.name);
        const safeTitle = esc(x.title ?? filenameToTitle(f.name));
        const status = x.status || "พร้อมอัปโหลด";
        const statusClass =
          status === "สำเร็จ" ? "ok" : status.startsWith("ผิดพลาด") ? "bad" : status === "กำลังอัปโหลด..." ? "run" : "";

        return `
          <div class="upload-item" data-idx="${idx}">
            <div class="upload-item__file">
              <div class="upload-item__name">${safeName}</div>
              <div class="muted upload-item__sub">${Math.round(f.size / 1024)} KB</div>
            </div>

            <div class="upload-item__title">
              <input class="upload-title-input" data-title-idx="${idx}" value="${safeTitle}" ${isUploading ? "disabled" : ""}/>
            </div>

            <div class="upload-item__status">
              <span class="upload-status ${statusClass}">${esc(status)}</span>
              ${x.error ? `<div class="upload-err">${esc(x.error)}</div>` : ""}
            </div>

            <div class="upload-item__remove">
              <button class="btn btn-ghost danger" data-remove-idx="${idx}" type="button" ${isUploading ? "disabled" : ""}>ลบ</button>
            </div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-remove-idx]").forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.getAttribute("data-remove-idx"));
        current.files.splice(idx, 1);
        render();
      };
    });

    list.querySelectorAll("[data-title-idx]").forEach((inp) => {
      inp.oninput = () => {
        const idx = Number(inp.getAttribute("data-title-idx"));
        current.files[idx].title = inp.value;
      };
    });
  };

  const open = ({ folder_id } = {}) => {
    current.folder_id = folder_id ?? null;
    ensureModal().style.display = "flex";
    render();
  };

  document.addEventListener("open-upload-modal", (ev) => open(ev.detail || {}));

  const setProgress = (done, total) => {
    const overlay = ensureModal();
    const box = overlay.querySelector("#uploadProgress");
    const fill = overlay.querySelector("#uploadProgressFill");
    const text = overlay.querySelector("#uploadProgressText");
    if (!box || !fill || !text) return;

    box.style.display = total ? "block" : "none";
    const pct = total ? Math.round((done / total) * 100) : 0;
    fill.style.width = `${pct}%`;
    text.textContent = total ? `อัปโหลด ${done}/${total} (${pct}%)` : "";
  };

  const uploadAll = async () => {
    const overlay = ensureModal();
    const errBox = overlay.querySelector("#uploadError");
    const btnDo = overlay.querySelector("#btnUploadDo");

    if (isUploading) return;
    if (!current.files.length) {
      errBox.textContent = "กรุณาเลือกไฟล์ก่อน";
      errBox.style.display = "block";
      return;
    }

    errBox.style.display = "none";
    errBox.textContent = "";

    if (!window.api?.documents?.upload) {
      errBox.textContent = "ไม่พบ window.api.documents.upload (เช็คว่าโหลด api.js แล้ว)";
      errBox.style.display = "block";
      return;
    }

    isUploading = true;
    btnDo.disabled = true;

    // set initial statuses
    current.files = current.files.map((x) => ({ ...x, status: "รอคิว", error: "" }));
    render();
    setProgress(0, current.files.length);

    let ok = 0, fail = 0;

    for (let i = 0; i < current.files.length; i++) {
      const item = current.files[i];
      item.status = "กำลังอัปโหลด...";
      item.error = "";
      render();

      try {
        const title = String(item.title || "").trim() || filenameToTitle(item.file.name);

        await window.api.documents.upload({
          file: item.file,
          folder_id: current.folder_id,
          title,
          description: null,
        });

        item.status = "สำเร็จ";
        ok++;
      } catch (e) {
        item.status = "ผิดพลาด";
        item.error = e?.message || String(e || "");
        fail++;
      }

      setProgress(i + 1, current.files.length);
      render();
    }

    isUploading = false;
    btnDo.disabled = false;

    alert(`อัปโหลดเสร็จ\nสำเร็จ: ${ok}\nผิดพลาด: ${fail}`);

    // refresh documents page
    window.dispatchEvent(new Event("force-render-route"));
  };

  // UI bindings
  document.addEventListener("click", (e) => {
    const overlay = document.getElementById("uploadModalOverlay");
    if (!overlay || overlay.style.display !== "flex") return;

    const pick = e.target.closest("#btnPickFiles");
    const clear = e.target.closest("#btnClearFiles");
    const doUpload = e.target.closest("#btnUploadDo");

    if (pick) {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;

        const mapped = files.map((f) => ({
          file: f,
          title: filenameToTitle(f.name), // ✅ default = ชื่อไฟล์เดิม (ตัดนามสกุล)
          status: "พร้อมอัปโหลด",
          error: "",
        }));

        current.files.push(...mapped);
        render();
      };
      input.click();
    }

    if (clear && !isUploading) {
      current.files = [];
      setProgress(0, 0);
      render();
    }

    if (doUpload) uploadAll();
  });

  window.uploadModal = { open };
})();