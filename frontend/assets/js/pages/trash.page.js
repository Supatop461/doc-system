// frontend/assets/js/pages/trash.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.trash = {
    async load({ ENDPOINTS, $, apiFetch, setUpdatedNow, applyRoute, showDetail }) {
      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "-");

      const leftTitle = $("leftTitle");
      const leftBadge = $("leftBadge");
      const leftBody = $("leftBody");

      if (!leftBody) {
        console.warn("[trash] leftBody not found");
        return;
      }

      // -------------------------
      // styles (เบาๆ ให้ดูเข้าธีม)
      // -------------------------
      if (!document.getElementById("__trashStyles")) {
        const st = document.createElement("style");
        st.id = "__trashStyles";
        st.textContent = `
          .trash-tabs{display:flex;gap:8px;flex-wrap:wrap}
          .trash-tab{padding:8px 12px;border-radius:999px;border:1px solid rgba(236,72,153,.25);background:#fff;color:#831843;font-weight:800;cursor:pointer}
          .trash-tab.active{background:#fce7f3;border-color:rgba(236,72,153,.4)}
          .trash-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.08);font-weight:900;font-size:12px}
          .trash-badge.doc{background:#eff6ff;color:#1d4ed8}
          .trash-badge.folder{background:#faf5ff;color:#7e22ce}
          .trash-row-title{font-weight:900}
        `;
        document.head.appendChild(st);
      }

      // -------------------------
      // state: current tab
      // -------------------------
      const TAB_KEY = "__trash_tab_v1";
      let currentType = localStorage.getItem(TAB_KEY) || "all";
      if (!["all", "documents", "folders"].includes(currentType)) currentType = "all";

      const fetchTrash = async (type) => {
        const base = ENDPOINTS.trash || "/api/trash";
        const url = `${base}?type=${encodeURIComponent(type)}`;
        return apiFetch(url);
      };

      const toUnifiedRows = (raw, type) => {
        const documents = Array.isArray(raw?.documents) ? raw.documents : [];
        const folders = Array.isArray(raw?.folders) ? raw.folders : [];

        if (type === "documents") {
          return documents.map((d) => ({
            kind: "document",
            id: d.document_id ?? d.id,
            name: d.original_file_name ?? d.name ?? "-",
            deleted_at: d.deleted_at ?? null,
            raw: d,
          }));
        }

        if (type === "folders") {
          return folders.map((f) => ({
            kind: "folder",
            id: f.folder_id ?? f.id,
            name: f.name ?? "-",
            deleted_at: f.deleted_at ?? null,
            raw: f,
          }));
        }

        // all
        const all = [
          ...documents.map((d) => ({
            kind: "document",
            id: d.document_id ?? d.id,
            name: d.original_file_name ?? d.name ?? "-",
            deleted_at: d.deleted_at ?? null,
            raw: d,
          })),
          ...folders.map((f) => ({
            kind: "folder",
            id: f.folder_id ?? f.id,
            name: f.name ?? "-",
            deleted_at: f.deleted_at ?? null,
            raw: f,
          })),
        ];

        // sort by deleted_at desc
        all.sort((a, b) => {
          const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
          const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
          return tb - ta;
        });

        return all;
      };

      const render = async () => {
        const raw = await fetchTrash(currentType);
        const rows = toUnifiedRows(raw, currentType);

        if (leftTitle) leftTitle.textContent = "ถังขยะ";
        if (leftBadge) leftBadge.textContent = `${rows.length} รายการ`;

        leftBody.innerHTML = `
          <div class="card" style="padding:14px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <div>
                <div style="font-weight:900;font-size:18px;">ถังขยะ (เอกสาร/แฟ้ม)</div>
                <div class="muted" style="margin-top:4px;">กู้คืนได้ </div>
              </div>
              <div class="trash-tabs">
                <button class="trash-tab ${currentType === "all" ? "active" : ""}" data-tab="all" type="button">ทั้งหมด</button>
                <button class="trash-tab ${currentType === "documents" ? "active" : ""}" data-tab="documents" type="button">เอกสาร</button>
                <button class="trash-tab ${currentType === "folders" ? "active" : ""}" data-tab="folders" type="button">แฟ้ม</button>
              </div>
            </div>

            <div style="margin-top:12px; overflow:auto;">
              <table class="doc-table">
                <thead>
                  <tr>
                    <th style="min-width:320px;">ชื่อ</th>
                    <th style="min-width:160px;">ประเภท</th>
                    <th style="min-width:180px;">ลบเมื่อ</th>
                    <th style="min-width:220px;">การทำงาน</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length
                      ? rows
                          .map((r) => {
                            const badge =
                              r.kind === "folder"
                                ? `<span class="trash-badge folder">📁 แฟ้ม</span>`
                                : `<span class="trash-badge doc">📄 เอกสาร</span>`;

                            return `
                              <tr data-kind="${esc(r.kind)}" data-id="${esc(r.id)}">
                                <td class="trash-row-title">${esc(r.name)}</td>
                                <td>${badge}</td>
                                <td>${esc(fmtDate(r.deleted_at))}</td>
                                <td style="white-space:nowrap;">
                                  <button class="btn btn-primary" data-action="restore" data-kind="${esc(
                                    r.kind
                                  )}" data-id="${esc(r.id)}" type="button" style="padding:6px 10px;border-radius:10px;">กู้คืน</button>
                                  <button class="btn btn-ghost" data-action="detail" data-kind="${esc(
                                    r.kind
                                  )}" data-id="${esc(r.id)}" type="button" style="padding:6px 10px;border-radius:10px;">ดู</button>
                                </td>
                              </tr>
                            `;
                          })
                          .join("")
                      : `<tr><td colspan="4" class="muted">ไม่มีข้อมูลในถังขยะ</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;

        // tabs
        leftBody.querySelectorAll("button[data-tab]").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const tab = btn.getAttribute("data-tab");
            if (!tab) return;
            currentType = tab;
            localStorage.setItem(TAB_KEY, currentType);
            await render();
          });
        });

        // actions
        leftBody.querySelectorAll("button[data-action]").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.preventDefault();

            const action = btn.getAttribute("data-action");
            const kind = btn.getAttribute("data-kind");
            const id = btn.getAttribute("data-id");

            if (!action || !kind || !id) return;

            if (action === "detail") {
              showDetail?.(`
                <div style="font-weight:900;font-size:16px;">${esc(kind === "folder" ? "📁 แฟ้ม" : "📄 เอกสาร")}</div>
                <div style="margin-top:8px; font-weight:900;">${esc(
                  kind === "folder" ? "ชื่อแฟ้ม" : "ชื่อเอกสาร"
                )}: ${esc(
                  (btn.closest("tr")?.querySelector("td")?.textContent || "").trim() || "-"
                )}</div>
                <div class="muted" style="margin-top:4px;">ID: ${esc(id)}</div>
              `);
              return;
            }

            if (action === "restore") {
              const label = kind === "folder" ? "กู้คืนแฟ้มนี้? (จะกู้คืนแฟ้มย่อยทั้งหมดด้วย)" : "กู้คืนเอกสารนี้?";
              if (!confirm(label)) return;

              try {
                if (kind === "folder") {
                  // ✅ restore folder (cascade)
                  await apiFetch(`/api/trash/folders/${encodeURIComponent(id)}/restore`, {
                    method: "POST",
                  });
                } else {
                  // ✅ restore document
                  await apiFetch(`/api/trash/${encodeURIComponent(id)}/restore`, {
                    method: "POST",
                  });
                }

                alert("กู้คืนแล้ว");
                await render();
                applyRoute?.("#trash");
              } catch (err) {
                alert(err?.message || "กู้คืนไม่สำเร็จ");
              }
            }
          });
        });

        setUpdatedNow?.();
      };

      await render();
    },
  };
})();
