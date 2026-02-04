// frontend/assets/js/pages/trash.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.trash = {
    async load({ ENDPOINTS, $, apiFetch, setUpdatedNow, applyRoute, showDetail }) {
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

      const leftTitle = $("leftTitle");
      const leftBadge = $("leftBadge");
      const leftBody = $("leftBody");

      if (!leftBody) {
        console.warn("[trash] leftBody not found");
        return;
      }

      const raw = await apiFetch(ENDPOINTS.trash || "/api/trash");
      const items = normalizeItems(raw);

      if (leftTitle) leftTitle.textContent = "ถังขยะ";
      if (leftBadge) leftBadge.textContent = `${items.length} รายการ`;

      leftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:900;font-size:16px;">เอกสารในถังขยะ</div>
              <div class="muted" style="margin-top:4px;">กู้คืนได้ (ไม่มีลบถาวรตามที่คุณสั่ง)</div>
            </div>
          </div>

          <div style="margin-top:12px; overflow:auto;">
            <table class="doc-table">
              <thead>
                <tr>
                  <th style="min-width:280px;">ชื่อเอกสาร</th>
                  <th style="min-width:180px;">ลบเมื่อ</th>
                  <th style="min-width:220px;">การทำงาน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  items.length
                    ? items
                        .map((it) => {
                          const id = it?.document_id ?? it?.id ?? "";
                          const nm = it?.original_file_name ?? it?.name ?? "-";
                          const del = it?.deleted_at ?? it?.deletedAt ?? null;
                          return `
                            <tr data-id="${esc(id)}">
                              <td style="font-weight:800;">${esc(nm)}</td>
                              <td>${esc(fmtDate(del))}</td>
                              <td style="white-space:nowrap;">
                                <button class="btn btn-primary" data-action="restore" data-id="${esc(
                                  id
                                )}" type="button" style="padding:6px 10px;border-radius:10px;">กู้คืน</button>
                                <button class="btn btn-ghost" data-action="detail" data-id="${esc(
                                  id
                                )}" type="button" style="padding:6px 10px;border-radius:10px;">ดู</button>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="3" class="muted">ไม่มีข้อมูลในถังขยะ</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      `;

      leftBody.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const action = btn.getAttribute("data-action");
          const id = btn.getAttribute("data-id");
          const it = items.find((x) => String(x?.document_id ?? x?.id) === String(id)) || {};

          if (action === "detail") {
            showDetail?.(`
              <div style="font-weight:900;font-size:16px;">${esc(it?.original_file_name ?? "-")}</div>
              <div class="muted" style="margin-top:4px;">ID: ${esc(id)}</div>
              <div style="margin-top:12px;line-height:1.9;">
                <div><b>ลบเมื่อ:</b> ${esc(fmtDate(it?.deleted_at ?? it?.deletedAt))}</div>
              </div>
            `);
            return;
          }

          if (action === "restore") {
            if (!confirm("กู้คืนเอกสารนี้?")) return;
            try {
              await apiFetch(`/api/trash/${encodeURIComponent(id)}/restore`, { method: "POST" });
              alert("กู้คืนแล้ว");
              applyRoute("#trash");
            } catch (err) {
              alert(err?.message || "กู้คืนไม่สำเร็จ");
            }
          }
        });
      });

      setUpdatedNow?.();
    },
  };
})();
