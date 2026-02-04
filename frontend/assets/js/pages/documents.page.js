// frontend/assets/js/pages/documents.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.documents = {
    async load({ ENDPOINTS, $, apiFetch, showDetail, setUpdatedNow, applyRoute }) {
      // -------------------------
      // Helpers
      // -------------------------
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

      const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "-");

      const fmtBytes = (bytes) => {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n <= 0) return "-";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let x = n,
          i = 0;
        while (x >= 1024 && i < units.length - 1) {
          x /= 1024;
          i++;
        }
        return `${x.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
      };

      const getId = (it) => it?.document_id ?? it?.id ?? "";
      const getName = (it) => it?.original_file_name ?? it?.name ?? it?.title ?? "-";
      const getType = (it) => it?.document_type_name ?? it?.mime_type ?? it?.type ?? "-";
      const getUpdated = (it) => it?.updated_at ?? it?.created_at ?? null;
      const getSize = (it) => it?.size_bytes ?? it?.file_size ?? it?.fileSize ?? null;
      const getFolderId = (it) => it?.folder_id ?? it?.folderId ?? it?.folder ?? null;

      const leftTitle = $("leftTitle");
      const leftBadge = $("leftBadge");
      const leftBody = $("leftBody");

      if (!leftBody) {
        console.warn("[documents] leftBody not found");
        return;
      }

      // -------------------------
      // Button New → upload modal
      // -------------------------
      const btnNew = $("btnNew");
      if (btnNew && btnNew.dataset.boundDocuments !== "1") {
        btnNew.dataset.boundDocuments = "1";
        btnNew.innerHTML = "＋ เพิ่มเอกสาร";
        btnNew.classList.add("btn", "btn-primary");
        btnNew.addEventListener("click", () => {
          // ใช้ระบบ upload modal ที่คุณทำไว้แล้ว (documents.upload.js)
          document.dispatchEvent(new CustomEvent("open-upload-modal"));
        });
      }

      // -------------------------
      // Load folders for filter
      // -------------------------
      let folders = [];
      try {
        const fr = await apiFetch(ENDPOINTS.folders);
        folders = normalizeItems(fr);
      } catch {
        folders = [];
      }

      // -------------------------
      // Load documents
      // -------------------------
      const raw = await apiFetch(ENDPOINTS.documents);
      const itemsAll = normalizeItems(raw);

      if (leftTitle) leftTitle.textContent = "เอกสารทั้งหมด";
      if (leftBadge) leftBadge.textContent = `${itemsAll.length} รายการ`;

      // -------------------------
      // Render UI (Search + Filter + Table)
      // -------------------------
      const folderOptions = [
        `<option value="">ทุกแฟ้ม</option>`,
        ...folders.map((f) => {
          const id = f?.folder_id ?? f?.id ?? "";
          const nm = f?.name ?? f?.folder_name ?? `แฟ้ม ${id}`;
          return `<option value="${esc(id)}">${esc(nm)}</option>`;
        }),
      ].join("");

      leftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:900;font-size:16px;">รายการเอกสาร</div>
              <div class="muted" style="margin-top:4px;">คลิกแถวเพื่อดูรายละเอียด / ใช้ปุ่มเพื่อดาวน์โหลดหรือลบ</div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end;">
              <input id="docKeyword" class="modal-input" placeholder="ค้นหาในหน้านี้…" style="min-width:240px;" />
              <select id="docFolderFilter" class="modal-select" style="min-width:180px;">
                ${folderOptions}
              </select>
            </div>
          </div>

          <div style="margin-top:12px; overflow:auto;">
            <table class="doc-table">
              <thead>
                <tr>
                  <th style="min-width:280px;">ชื่อเอกสาร</th>
                  <th style="min-width:160px;">ประเภท</th>
                  <th style="min-width:110px;">ขนาด</th>
                  <th style="min-width:180px;">อัปเดต</th>
                  <th style="min-width:220px;">การทำงาน</th>
                </tr>
              </thead>
              <tbody id="docTbody"></tbody>
            </table>
          </div>
        </div>
      `;

      const tbody = $("docTbody");
      const keywordEl = $("docKeyword");
      const folderEl = $("docFolderFilter");

      const renderRows = (rows) => {
        if (!tbody) return;

        tbody.innerHTML = rows.length
          ? rows
              .map((it) => {
                const id = getId(it);
                return `
                  <tr data-id="${esc(id)}" style="cursor:pointer;">
                    <td style="font-weight:800;">${esc(getName(it))}</td>
                    <td>${esc(getType(it))}</td>
                    <td>${getSize(it) == null ? "-" : esc(fmtBytes(getSize(it)))}</td>
                    <td>${esc(fmtDate(getUpdated(it)))}</td>
                    <td style="white-space:nowrap;">
                      <button class="btn btn-primary" data-action="detail" data-id="${esc(
                        id
                      )}" type="button" style="padding:6px 10px;border-radius:10px;">ดู</button>
                      <button class="btn btn-ghost" data-action="download" data-id="${esc(
                        id
                      )}" type="button" style="padding:6px 10px;border-radius:10px;">ดาวน์โหลด</button>
                      <button class="btn btn-ghost" data-action="trash" data-id="${esc(
                        id
                      )}" type="button" style="padding:6px 10px;border-radius:10px;background:#ffe3ea;">ลบ</button>
                    </td>
                  </tr>
                `;
              })
              .join("")
          : `<tr><td colspan="5" class="muted">ยังไม่มีเอกสาร</td></tr>`;
      };

      const applyFilters = () => {
        const kw = String(keywordEl?.value || "").trim().toLowerCase();
        const fid = String(folderEl?.value || "").trim();

        const filtered = itemsAll.filter((it) => {
          const hitKw = !kw || String(getName(it)).toLowerCase().includes(kw);
          const hitFolder = !fid || String(getFolderId(it) ?? "") === String(fid);
          return hitKw && hitFolder;
        });

        if (leftBadge) leftBadge.textContent = `${filtered.length} รายการ`;
        renderRows(filtered);
        bindActions(filtered);
      };

      const bindActions = (rows) => {
        const scope = leftBody;

        // row click (ถ้าคลิกปุ่มให้ข้าม)
        scope.querySelectorAll('tr[data-id]').forEach((tr) => {
          tr.onclick = (e) => {
            const btn = e.target?.closest?.("button[data-action]");
            if (btn) return;
            const id = tr.getAttribute("data-id");
            const it = rows.find((x) => String(getId(x)) === String(id)) || {};
            openDetail(id, it);
          };
        });

        // buttons
        scope.querySelectorAll("button[data-action]").forEach((btn) => {
          btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const action = btn.getAttribute("data-action");
            const id = btn.getAttribute("data-id");
            const it = rows.find((x) => String(getId(x)) === String(id)) || {};

            if (action === "download") {
              window.open(`/api/documents/${encodeURIComponent(id)}/download`, "_blank");
              return;
            }

            if (action === "trash") {
              if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
              try {
                await apiFetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
                alert("ลบแล้ว (ย้ายไปถังขยะ)");
                applyRoute("#all");
              } catch (err) {
                alert(err?.message || "ลบไม่สำเร็จ");
              }
              return;
            }

            if (action === "detail") {
              openDetail(id, it);
            }
          };
        });
      };

      const openDetail = (id, it) => {
        showDetail?.(
          `
          <div style="font-weight:900;font-size:16px;">${esc(getName(it))}</div>
          <div class="muted" style="margin-top:4px;">ID: ${esc(id)}</div>

          <div style="margin-top:12px;line-height:1.9;">
            <div><b>ประเภท:</b> ${esc(getType(it))}</div>
            <div><b>ขนาด:</b> ${getSize(it) == null ? "-" : esc(fmtBytes(getSize(it)))}</div>
            <div><b>อัปเดต:</b> ${esc(fmtDate(getUpdated(it)))}</div>
          </div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" id="btnDlNow" type="button">ดาวน์โหลด</button>
            <button class="btn btn-ghost" id="btnTrashNow" type="button" style="background:#ffe3ea;">ลบ → ถังขยะ</button>
          </div>
        `
        );

        $("btnDlNow")?.addEventListener("click", () => {
          window.open(`/api/documents/${encodeURIComponent(id)}/download`, "_blank");
        });

        $("btnTrashNow")?.addEventListener("click", async () => {
          if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
          try {
            await apiFetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
            alert("ลบแล้ว (ย้ายไปถังขยะ)");
            applyRoute("#all");
          } catch (err) {
            alert(err?.message || "ลบไม่สำเร็จ");
          }
        });
      };

      // initial render
      applyFilters();

      // bind filters
      keywordEl?.addEventListener("input", applyFilters);
      folderEl?.addEventListener("change", applyFilters);

      setUpdatedNow?.();
    },
  };
})();
