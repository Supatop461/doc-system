// frontend/assets/js/pages/search.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.search = {
    async load({ ENDPOINTS, $, apiFetch, showDetail, setUpdatedNow }) {
      // =========================
      // Helpers
      // =========================
      const normalizeItems = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        if (Array.isArray(raw?.documents)) return raw.documents;
        return [];
      };

      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const fmtDate = (d) => (d ? new Date(d).toLocaleString("th-TH") : "-");

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
      const getTitle = (it) => it?.title ?? it?.document_title ?? "";
      const getFileName = (it) => it?.original_file_name ?? it?.file_name ?? it?.name ?? "";
      const getName = (it) => String(getTitle(it) || "").trim() || String(getFileName(it) || "").trim() || "-";
      const getMime = (it) => it?.mime_type ?? it?.type ?? "";
      const getUpdated = (it) => it?.updated_at ?? it?.created_at ?? null;
      const getSize = (it) => it?.file_size ?? it?.size_bytes ?? it?.fileSize ?? null;

      const getToken = () => window.api?.getToken?.() || localStorage.getItem("token") || "";

      async function fetchBlobWithAuth(url) {
        const token = getToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const res = await fetch(url, { method: "GET", headers });
        if (res.status === 401) {
          window.api?.logoutAndRedirect?.();
          throw new Error("ต้องเข้าสู่ระบบใหม่");
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let msg = text || `Request failed (${res.status})`;
          try {
            const j = text ? JSON.parse(text) : {};
            msg = j?.message || msg;
          } catch {}
          throw new Error(msg);
        }
        return await res.blob();
      }

      const extOf = (name) => {
        const s = String(name || "").trim().toLowerCase();
        const m = s.match(/(\.[a-z0-9]{1,8})$/i);
        return m ? m[1] : "";
      };

      const guessKind = (it) => {
        const mime = String(getMime(it) || "").toLowerCase();
        const ext = extOf(getFileName(it) || getName(it));
        if (mime.includes("pdf") || ext === ".pdf") return "pdf";
        if (mime.includes("word") || ext === ".doc" || ext === ".docx") return "word";
        if (mime.includes("excel") || ext === ".xls" || ext === ".xlsx") return "excel";
        if (mime.includes("powerpoint") || ext === ".ppt" || ext === ".pptx") return "ppt";
        if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
        return "other";
      };

      const iconOf = (kind) => {
        if (kind === "pdf") return "📕";
        if (kind === "word") return "🟦";
        if (kind === "excel") return "🟩";
        if (kind === "ppt") return "🟧";
        if (kind === "image") return "🖼️";
        return "📄";
      };

      const parseHashQuery = () => {
        const raw = String(location.hash || "");
        const qpos = raw.indexOf("?");
        if (qpos === -1) return {};
        const qs = raw.slice(qpos + 1);
        const params = new URLSearchParams(qs);
        return Object.fromEntries(params.entries());
      };

      /**
       * ✅ สำคัญ: อัปเดต query ใน hash แบบ "ไม่เรียก router ซ้ำ"
       * - ห้ามใช้ applyRoute ที่ทำให้ renderRoute วน
       * - ใช้ history.replaceState แทน (ไม่ trigger hashchange)
       */
      const setHashQuerySilent = (obj) => {
        const qs = new URLSearchParams(obj || {}).toString();
        const next = `#search${qs ? `?${qs}` : ""}`;
        if (location.hash === next) return;
        history.replaceState(null, "", next);
      };

      // =========================
      // Toast (เล็ก ๆ)
      // =========================
      function ensureToastHost() {
        let host = document.getElementById("toastHost");
        if (host) return host;
        host = document.createElement("div");
        host.id = "toastHost";
        host.className = "toast-host";
        document.body.appendChild(host);
        return host;
      }

      function toast(message, type = "info", timeout = 2400) {
        const host = ensureToastHost();
        const el = document.createElement("div");
        el.className = `toast toast--${type}`;
        el.innerHTML = `
          <div class="toast__dot"></div>
          <div class="toast__msg">${esc(message)}</div>
          <button class="toast__x" title="ปิด">✕</button>
        `;
        host.appendChild(el);
        const close = () => {
          el.classList.add("toast--hide");
          setTimeout(() => el.remove(), 220);
        };
        el.querySelector(".toast__x").onclick = close;
        setTimeout(close, timeout);
      }

      // =========================
      // Layout refs
      // =========================
      const leftTitle = $("leftTitle");
      const leftBadge = $("leftBadge");
      const leftBody = $("leftBody");

      if (!leftBody) return;

      if (leftTitle) leftTitle.textContent = "ค้นหา";
      if (leftBadge) leftBadge.textContent = "—";

      // =========================
      // UI
      // =========================
      leftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-weight:950;font-size:16px;">🔎 ค้นหาเอกสาร</div>
         
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end;">
              <div style="position:relative;">
                <input id="searchKeyword" class="modal-input" placeholder="พิมพ์ชื่อไฟล์ เช่น รายงาน / pdf / xlsx" style="min-width:360px; padding-right:40px;" />
                <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%); opacity:.65;">⌨️</span>
                <div id="searchSuggest" style="position:absolute; left:0; right:0; top:calc(100% + 8px); display:none; z-index:20;"></div>
              </div>

              <select id="searchType" class="modal-select doc-select" style="min-width:170px;">
                <option value="all">ทุกประเภท</option>
                <option value="pdf">PDF</option>
                <option value="word">Word</option>
                <option value="excel">Excel</option>
                <option value="ppt">PowerPoint</option>
                <option value="image">รูปภาพ</option>
                <option value="other">อื่น ๆ</option>
              </select>

              <select id="searchSort" class="modal-select doc-select" style="min-width:170px;">
                <option value="updated_desc">ล่าสุดก่อน</option>
                <option value="updated_asc">เก่าก่อน</option>
                <option value="name_asc">ชื่อ A-Z</option>
                <option value="name_desc">ชื่อ Z-A</option>
              </select>

              <button id="btnClear" class="btn btn-ghost" type="button" style="border-radius:12px;">ล้าง</button>
            </div>
          </div>

          <div class="muted" id="searchHint" style="margin-top:10px;"></div>

          <div style="margin-top:12px; overflow:auto;">
            <table class="doc-table">
              <thead>
                <tr>
                  <th style="min-width:320px;">ชื่อเอกสาร</th>
                  <th style="min-width:140px;">ประเภท</th>
                  <th style="min-width:110px;">ขนาด</th>
                  <th style="min-width:180px;">อัปเดต</th>
                  <th style="min-width:260px;">การทำงาน</th>
                </tr>
              </thead>
              <tbody id="searchTbody">
                <tr><td colspan="5" class="muted">เริ่มพิมพ์เพื่อค้นหา…</td></tr>
              </tbody>
            </table>
          </div>

          <div class="muted" id="searchFoot" style="margin-top:10px;"></div>
        </div>
      `;

      const keywordEl = $("searchKeyword");
      const typeEl = $("searchType");
      const sortEl = $("searchSort");
      const clearEl = $("btnClear");
      const hintEl = $("searchHint");
      const footEl = $("searchFoot");
      const tbody = $("searchTbody");
      const suggestBox = $("searchSuggest");

      // =========================
      // State
      // =========================
      let allCache = null; // fallback cache
      let debounceTimer = null;
      let suggestIndex = -1;
      let suggestItems = [];

      // =========================
      // Render helpers
      // =========================
      const applySort = (arr, mode) => {
        const rows = [...arr];
        const getU = (x) => new Date(getUpdated(x) || 0).getTime();
        const getN = (x) => String(getName(x) || "").toLowerCase();
        switch (mode) {
          case "updated_asc":
            rows.sort((a, b) => getU(a) - getU(b));
            break;
          case "name_asc":
            rows.sort((a, b) => getN(a).localeCompare(getN(b), "th"));
            break;
          case "name_desc":
            rows.sort((a, b) => getN(b).localeCompare(getN(a), "th"));
            break;
          default:
            rows.sort((a, b) => getU(b) - getU(a));
            break;
        }
        return rows;
      };

      const filterByKind = (arr, kind) => {
        if (!kind || kind === "all") return arr;
        return arr.filter((x) => guessKind(x) === kind);
      };

      const openDetail = (id, it) => {
        const kind = guessKind(it);
        const mime = getMime(it);

        showDetail?.(`
          <div style="font-weight:950;font-size:16px;">${iconOf(kind)} ${esc(getName(it))}</div>
          <div class="muted" style="margin-top:6px;">ID: ${esc(id)}</div>

          <div style="margin-top:12px;line-height:1.9;">
            <div><b>ประเภท:</b> ${esc(mime || kind.toUpperCase())}</div>
            <div><b>ชื่อไฟล์:</b> ${esc(getFileName(it) || "-")}</div>
            <div><b>ขนาด:</b> ${getSize(it) == null ? "-" : esc(fmtBytes(getSize(it)))}</div>
            <div><b>อัปเดต:</b> ${esc(fmtDate(getUpdated(it)))}</div>
          </div>

          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary modern" id="btnPvNow" type="button">พรีวิว</button>
            <button class="btn btn-ghost modern" id="btnDlNow" type="button">ดาวน์โหลด</button>
            <button class="btn btn-ghost danger modern" id="btnTrashNow" type="button" style="background:#ffe3ea;">ลบ → ถังขยะ</button>
          </div>
        `);

        $("btnPvNow")?.addEventListener("click", async () => {
          try {
            const url = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/preview`;
            const blob = await fetchBlobWithAuth(url);
            const obj = URL.createObjectURL(blob);
            window.open(obj, "_blank");
            setTimeout(() => URL.revokeObjectURL(obj), 15000);
          } catch (err) {
            toast(err?.message || "พรีวิวไม่สำเร็จ", "error", 4200);
          }
        });

        $("btnDlNow")?.addEventListener("click", async () => {
          try {
            const url = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;
            const blob = await fetchBlobWithAuth(url);
            const obj = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = obj;
            a.download = getName(it) || `document-${id}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(obj), 15000);
          } catch (err) {
            toast(err?.message || "ดาวน์โหลดไม่สำเร็จ", "error", 4200);
          }
        });

        $("btnTrashNow")?.addEventListener("click", async () => {
          if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
          try {
            await apiFetch(`${ENDPOINTS.documents}/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast("ย้ายไปถังขยะแล้ว", "success");
            await doSearch();
          } catch (err) {
            toast(err?.message || "ลบไม่สำเร็จ", "error", 4200);
          }
        });
      };

      const renderRows = (rows) => {
        if (leftBadge) leftBadge.textContent = rows.length ? `${rows.length} รายการ` : "—";

        if (!tbody) return;
        if (!rows.length) {
          tbody.innerHTML = `<tr><td colspan="5" class="muted">ไม่พบผลลัพธ์</td></tr>`;
          return;
        }

        tbody.innerHTML = rows
          .map((it) => {
            const id = String(getId(it));
            const kind = guessKind(it);
            const name = getName(it);
            const fileName = getFileName(it);
            const mime = getMime(it);

            return `
              <tr data-id="${esc(id)}" style="cursor:pointer;">
                <td style="font-weight:900;">
                  <span style="margin-right:8px;">${iconOf(kind)}</span>${esc(name)}
                  <div class="muted" style="margin-top:4px; font-weight:600;">${esc(fileName || mime || "")}</div>
                </td>
                <td>${esc(mime || kind.toUpperCase())}</td>
                <td>${getSize(it) == null ? "-" : esc(fmtBytes(getSize(it)))}</td>
                <td>${esc(fmtDate(getUpdated(it)))}</td>
                <td style="white-space:nowrap;">
                  <button class="btn btn-primary modern" data-action="detail" data-id="${esc(id)}" type="button" style="padding:6px 10px;border-radius:10px;">ดู</button>
                  <button class="btn btn-ghost modern" data-action="preview" data-id="${esc(id)}" type="button" style="padding:6px 10px;border-radius:10px;">พรีวิว</button>
                  <button class="btn btn-ghost modern" data-action="download" data-id="${esc(id)}" type="button" style="padding:6px 10px;border-radius:10px;">ดาวน์โหลด</button>
                  <button class="btn btn-ghost danger modern" data-action="trash" data-id="${esc(id)}" type="button" style="padding:6px 10px;border-radius:10px;background:#ffe3ea;">ลบ</button>
                </td>
              </tr>
            `;
          })
          .join("");

        // row click -> detail
        leftBody.querySelectorAll('tr[data-id]').forEach((tr) => {
          tr.onclick = (e) => {
            const btn = e.target?.closest?.("button[data-action]");
            if (btn) return;
            const id = tr.getAttribute("data-id");
            const it = rows.find((x) => String(getId(x)) === String(id));
            if (it) openDetail(String(id), it);
          };
        });

        // buttons
        leftBody.querySelectorAll("button[data-action]").forEach((btn) => {
          btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const action = btn.getAttribute("data-action");
            const id = String(btn.getAttribute("data-id") || "");
            const it = rows.find((x) => String(getId(x)) === String(id)) || {};

            if (!id) return;

            if (action === "detail") return openDetail(id, it);

            if (action === "preview") {
              try {
                const url = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/preview`;
                const blob = await fetchBlobWithAuth(url);
                const obj = URL.createObjectURL(blob);
                window.open(obj, "_blank");
                setTimeout(() => URL.revokeObjectURL(obj), 15000);
              } catch (err) {
                toast(err?.message || "พรีวิวไม่สำเร็จ", "error", 4200);
              }
              return;
            }

            if (action === "download") {
              try {
                const url = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;
                const blob = await fetchBlobWithAuth(url);
                const obj = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = obj;
                a.download = getName(it) || `document-${id}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(obj), 15000);
                toast("เริ่มดาวน์โหลดแล้ว", "success");
              } catch (err) {
                toast(err?.message || "ดาวน์โหลดไม่สำเร็จ", "error", 4200);
              }
              return;
            }

            if (action === "trash") {
              if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
              try {
                await apiFetch(`${ENDPOINTS.documents}/${encodeURIComponent(id)}`, { method: "DELETE" });
                toast("ย้ายไปถังขยะแล้ว", "success");
                await doSearch();
              } catch (err) {
                toast(err?.message || "ลบไม่สำเร็จ", "error", 4200);
              }
            }
          };
        });
      };

      // =========================
      // Autocomplete
      // =========================
      const highlight = (text, q) => {
        const s = String(text || "");
        const k = String(q || "").trim();
        if (!k) return esc(s);
        const i = s.toLowerCase().indexOf(k.toLowerCase());
        if (i === -1) return esc(s);
        const a = s.slice(0, i);
        const b = s.slice(i, i + k.length);
        const c = s.slice(i + k.length);
        return `${esc(a)}<span style="background:rgba(232,62,140,.14);border-radius:8px;padding:0 6px;font-weight:950;">${esc(
          b
        )}</span>${esc(c)}`;
      };

      const closeSuggest = () => {
        if (!suggestBox) return;
        suggestBox.style.display = "none";
        suggestBox.innerHTML = "";
        suggestIndex = -1;
        suggestItems = [];
      };

      const openSuggest = (q, rows) => {
        if (!suggestBox) return;

        const seen = new Set();
        const list = [];
        for (const it of rows) {
          const name = getName(it);
          if (name && !seen.has(name)) {
            seen.add(name);
            list.push({ label: name, id: String(getId(it) || ""), it });
          }
          const fn = getFileName(it);
          if (fn && !seen.has(fn)) {
            seen.add(fn);
            list.push({ label: fn, id: String(getId(it) || ""), it });
          }
          if (list.length >= 8) break;
        }

        suggestItems = list;
        if (!list.length) return closeSuggest();

        suggestIndex = -1;
        suggestBox.style.display = "block";
        suggestBox.innerHTML = `
          <div style="background:#fff;border:1px solid rgba(120,0,70,.12);box-shadow:0 18px 40px rgba(120,0,70,.12);border-radius:14px;overflow:hidden;">
            ${list
              .map(
                (x, idx) => `
              <div data-sidx="${idx}" style="display:flex;gap:10px;align-items:center;padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(120,0,70,.08);">
                <div style="width:22px;text-align:center;">${iconOf(guessKind(x.it))}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${highlight(x.label, q)}
                  </div>
                  <div class="muted" style="margin-top:3px;font-weight:700;">ID: ${esc(x.id || "-")}</div>
                </div>
                <div class="muted" style="font-weight:900;">↩︎</div>
              </div>
            `
              )
              .join("")}
          </div>
        `;

        suggestBox.querySelectorAll("[data-sidx]").forEach((el) => {
          el.onclick = () => {
            const idx = Number(el.getAttribute("data-sidx"));
            const item = suggestItems[idx];
            if (!item) return;
            keywordEl.value = item.label;
            closeSuggest();
            doSearch();
          };
        });
      };

      const moveSuggest = (dir) => {
        if (!suggestItems.length || !suggestBox || suggestBox.style.display === "none") return;
        suggestIndex += dir;
        if (suggestIndex < 0) suggestIndex = suggestItems.length - 1;
        if (suggestIndex >= suggestItems.length) suggestIndex = 0;

        suggestBox.querySelectorAll("[data-sidx]").forEach((el) => {
          const idx = Number(el.getAttribute("data-sidx"));
          el.style.background = idx === suggestIndex ? "rgba(232,62,140,.08)" : "";
        });
      };

      const pickSuggest = () => {
        if (suggestIndex < 0 || suggestIndex >= suggestItems.length) return false;
        const item = suggestItems[suggestIndex];
        if (!item) return false;
        keywordEl.value = item.label;
        closeSuggest();
        doSearch();
        return true;
      };

      document.addEventListener("click", (e) => {
        const inBox = e.target?.closest?.("#searchSuggest");
        const inInput = e.target?.closest?.("#searchKeyword");
        if (!inBox && !inInput) closeSuggest();
      });

      // =========================
      // Search logic (API first, fallback)
      // =========================
      const trySearchApi = async (q) => {
        const url = `${ENDPOINTS.documents}/search?q=${encodeURIComponent(q)}`;
        return await apiFetch(url);
      };

      const fetchAllForFallback = async () => {
        if (allCache) return allCache;
        const raw = await apiFetch(`${ENDPOINTS.documents}?limit=100&offset=0`);
        allCache = normalizeItems(raw);
        return allCache;
      };

      const localFilter = (rows, q) => {
        const kw = String(q || "").trim().toLowerCase();
        if (!kw) return [];
        return rows.filter((it) => {
          const n = String(getName(it)).toLowerCase();
          const f = String(getFileName(it)).toLowerCase();
          const m = String(getMime(it)).toLowerCase();
          return n.includes(kw) || f.includes(kw) || m.includes(kw);
        });
      };

      const doSearch = async () => {
        const q = String(keywordEl?.value || "").trim();
        const kind = String(typeEl?.value || "all");
        const sort = String(sortEl?.value || "updated_desc");

        // ✅ อัปเดต hash แบบไม่ทำให้ route rerender วน
        setHashQuerySilent(q ? { q, type: kind, sort } : {});

        if (!q) {
          closeSuggest();
          if (leftBadge) leftBadge.textContent = "—";
          if (hintEl) hintEl.textContent = "เริ่มพิมพ์เพื่อค้นหา…";
          if (footEl) footEl.textContent = "";
          tbody.innerHTML = `<tr><td colspan="5" class="muted">เริ่มพิมพ์เพื่อค้นหา…</td></tr>`;
          return;
        }

        if (hintEl) hintEl.textContent = `กำลังค้นหา: "${q}"`;
        if (footEl) footEl.textContent = "";

        try {
          let rows = [];
          let source = "";

          try {
            const data = await trySearchApi(q);
            rows = normalizeItems(data);
            source = "API Search";
          } catch {
            const all = await fetchAllForFallback();
            rows = localFilter(all, q);
            source = "Fallback";
          }

          rows = filterByKind(rows, kind);
          rows = applySort(rows, sort);

          renderRows(rows);
          openSuggest(q, rows);

          if (hintEl) hintEl.textContent = `ผลลัพธ์: "${q}" • ${source}`;
          if (footEl) footEl.textContent = `ทิป: ใช้ปุ่ม ↑ ↓ เลือก autocomplete แล้วกด Enter ได้`;
          setUpdatedNow?.();
        } catch (err) {
          closeSuggest();
          tbody.innerHTML = `<tr><td colspan="5" class="muted" style="color:#b91c1c;">ค้นหาไม่สำเร็จ: ${esc(
            err?.message || ""
          )}</td></tr>`;
          toast(err?.message || "ค้นหาไม่สำเร็จ", "error", 4200);
        }
      };

      const debounceSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doSearch, 220);
      };

      // =========================
      // Bind events
      // =========================
      keywordEl?.addEventListener("input", debounceSearch);

      keywordEl?.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveSuggest(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveSuggest(-1);
          return;
        }
        if (e.key === "Enter") {
          if (pickSuggest()) return;
          doSearch();
          return;
        }
        if (e.key === "Escape") closeSuggest();
      });

      typeEl?.addEventListener("change", doSearch);
      sortEl?.addEventListener("change", doSearch);

      clearEl?.addEventListener("click", () => {
        if (keywordEl) keywordEl.value = "";
        closeSuggest();
        allCache = null;
        setHashQuerySilent({});
        if (leftBadge) leftBadge.textContent = "—";
        if (hintEl) hintEl.textContent = "";
        if (footEl) footEl.textContent = "";
        tbody.innerHTML = `<tr><td colspan="5" class="muted">เริ่มพิมพ์เพื่อค้นหา…</td></tr>`;
        setUpdatedNow?.();
      });

      // =========================
      // Auto run from hash (?q=...)
      // =========================
      const qs = parseHashQuery();
      if (qs.q && keywordEl) keywordEl.value = String(qs.q);
      if (qs.type && typeEl) typeEl.value = String(qs.type);
      if (qs.sort && sortEl) sortEl.value = String(qs.sort);

      if (qs.q) await doSearch();
      else if (hintEl) hintEl.textContent = "เริ่มพิมพ์เพื่อค้นหา…";

      setUpdatedNow?.();
    },
  };
})();