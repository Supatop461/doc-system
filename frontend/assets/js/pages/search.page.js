// frontend/assets/js/pages/search.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.search = {
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

      const parseHashQuery = () => {
        const raw = String(location.hash || "");
        const qpos = raw.indexOf("?");
        if (qpos === -1) return {};
        const qs = raw.slice(qpos + 1);
        const params = new URLSearchParams(qs);
        return Object.fromEntries(params.entries());
      };

      const setHashQuery = (q) => {
        const qs = new URLSearchParams(q || {}).toString();
        applyRoute(`#search${qs ? `?${qs}` : ""}`);
      };

      // -------------------------
      // DOM
      // -------------------------
      const leftTitle = $("leftTitle");
      const leftBadge = $("leftBadge");
      const leftBody = $("leftBody");

      if (!leftBody) {
        console.warn("[search] leftBody not found");
        return;
      }

      if (leftTitle) leftTitle.textContent = "ค้นหา";
      if (leftBadge) leftBadge.textContent = "—";

      // -------------------------
      // UI
      // -------------------------
      leftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:900;font-size:16px;">ค้นหาเอกสาร</div>
              <div class="muted" style="margin-top:4px;">ค้นหาจากชื่อไฟล์ / ประเภท (รองรับ fallback ถ้าไม่มี API search)</div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end;">
              <input id="searchKeyword" class="modal-input" placeholder="พิมพ์คำค้น เช่น ชื่อไฟล์ / pdf / jpg" style="min-width:320px;" />
              <button id="btnSearch" class="btn btn-primary" type="button" style="border-radius:12px;">ค้นหา</button>
              <button id="btnClear" class="btn btn-ghost" type="button" style="border-radius:12px;">ล้าง</button>
            </div>
          </div>

          <div id="searchHint" class="muted" style="margin-top:10px;"></div>

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
              <tbody id="searchTbody">
                <tr><td colspan="5" class="muted">พิมพ์คำค้นแล้วกด “ค้นหา”</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const keywordEl = $("searchKeyword");
      const btnSearch = $("btnSearch");
      const btnClear = $("btnClear");
      const hintEl = $("searchHint");
      const tbody = $("searchTbody");

      const renderRows = (rows) => {
        if (!tbody) return;

        if (leftBadge) leftBadge.textContent = `${rows.length} รายการ`;

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
          : `<tr><td colspan="5" class="muted">ไม่พบผลลัพธ์</td></tr>`;
      };

      const bindActions = (rows) => {
        const scope = leftBody;

        // row click open detail (skip if button)
        scope.querySelectorAll('tr[data-id]').forEach((tr) => {
          tr.onclick = (e) => {
            const btn = e.target?.closest?.("button[data-action]");
            if (btn) return;
            const id = tr.getAttribute("data-id");
            const it = rows.find((x) => String(getId(x)) === String(id)) || {};
            openDetail(id, it);
          };
        });

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
                // rerun search
                await doSearch();
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
            await doSearch();
          } catch (err) {
            alert(err?.message || "ลบไม่สำเร็จ");
          }
        });
      };

      // -------------------------
      // Search logic (API first, fallback filter)
      // -------------------------
      const trySearchApi = async (q) => {
        // ลอง endpoint ที่พบบ่อย: /documents/search?q=
        const url = `${ENDPOINTS.documents}/search?q=${encodeURIComponent(q)}`;
        return await apiFetch(url);
      };

      const fallbackSearchLocal = async (q) => {
        const all = await apiFetch(ENDPOINTS.documents);
        const rows = normalizeItems(all);
        const kw = String(q || "").trim().toLowerCase();
        if (!kw) return rows;

        return rows.filter((it) => {
          const name = String(getName(it)).toLowerCase();
          const type = String(getType(it)).toLowerCase();
          return name.includes(kw) || type.includes(kw);
        });
      };

      const doSearch = async () => {
        const q = String(keywordEl?.value || "").trim();
        setHashQuery(q ? { q } : {});

        if (hintEl) hintEl.textContent = q ? `กำลังค้นหา: "${q}"` : "พิมพ์คำค้นแล้วกด “ค้นหา”";
        if (!q) {
          renderRows([]);
          if (leftBadge) leftBadge.textContent = "—";
          tbody.innerHTML = `<tr><td colspan="5" class="muted">พิมพ์คำค้นแล้วกด “ค้นหา”</td></tr>`;
          return;
        }

        try {
          // 1) try API search
          let data;
          try {
            data = await trySearchApi(q);
            const rows = normalizeItems(data);
            renderRows(rows);
            bindActions(rows);
            if (hintEl) hintEl.textContent = `ผลลัพธ์จาก API Search: "${q}"`;
            return;
          } catch {
            // ignore and fallback
          }

          // 2) fallback
          const rows = await fallbackSearchLocal(q);
          renderRows(rows);
          bindActions(rows);
          if (hintEl) hintEl.textContent = `ผลลัพธ์จากการค้นหาในหน้านี้: "${q}" (fallback)`;
        } catch (err) {
          if (hintEl) hintEl.textContent = "";
          alert(err?.message || "ค้นหาไม่สำเร็จ");
        }
      };

      // bind events
      btnSearch?.addEventListener("click", doSearch);
      btnClear?.addEventListener("click", () => {
        if (keywordEl) keywordEl.value = "";
        setHashQuery({});
        tbody.innerHTML = `<tr><td colspan="5" class="muted">พิมพ์คำค้นแล้วกด “ค้นหา”</td></tr>`;
        if (leftBadge) leftBadge.textContent = "—";
        if (hintEl) hintEl.textContent = "";
      });

      keywordEl?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });

      // auto-run if hash has ?q=
      const qs = parseHashQuery();
      if (qs.q && keywordEl) {
        keywordEl.value = String(qs.q);
        await doSearch();
      }

      setUpdatedNow?.();
    },
  };
})();
