// frontend/assets/js/pages/documents.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.documents = {
    async load(ctx) {
      const { ENDPOINTS, apiFetch, setUpdatedNow } = ctx;
      const $ = (sel) => document.querySelector(sel);

      const leftTitle = $("#leftTitle");
      const leftBadge = $("#leftBadge");
      const leftBody = $("#leftBody");

      const pageTitle = $("#pageTitle");
      const pageDesc = $("#pageDesc");
      const btnNew = $("#btnNew");

      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const normalizeItems = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        return [];
      };

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

      const safeVal = (v, fallback) => {
        const s = String(v ?? "").trim();
        return s ? s : fallback;
      };

      const getHashQuery = () => {
        const h = String(location.hash || "");
        const qIndex = h.indexOf("?");
        if (qIndex === -1) return {};
        const qs = h.slice(qIndex + 1);
        const sp = new URLSearchParams(qs);
        const obj = {};
        for (const [k, v] of sp.entries()) obj[k] = v;
        return obj;
      };

      const q = getHashQuery();
      const routeFolderId = q.folder_id ? String(q.folder_id) : "";

      // =========================
      // Toast
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

      function toast(message, type = "info", timeout = 2800) {
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
      // Blob with Authorization
      // =========================
      async function fetchBlobWithAuth(url) {
        const token = window.api?.getToken?.() || localStorage.getItem("token") || "";
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

      // =========================
      // Data helpers
      // =========================
      const getId = (d) => d?.document_id ?? d?.id ?? "";
      const getName = (d) => d?.title ?? d?.document_title ?? d?.original_file_name ?? d?.name ?? "-";
      const getFileName = (d) => d?.original_file_name ?? d?.file_name ?? "-";
      const getMime = (d) => d?.mime_type ?? d?.type ?? d?.document_type_name ?? "-";
      const getSize = (d) => d?.size_bytes ?? d?.file_size ?? d?.size ?? null;
      const getUpdated = (d) => d?.updated_at ?? d?.created_at ?? null;
      const getFolderId = (d) => d?.folder_id ?? d?.folderId ?? d?.folder ?? null;

      // folder fields
      const folderIdOf = (f) => String(f?.folder_id ?? f?.id ?? "");
      const folderNameOf = (f) => String(f?.name ?? f?.folder_name ?? `แฟ้ม ${folderIdOf(f)}`);
      const folderParentOf = (f) => f?.parent_id ?? f?.parentId ?? f?.parent ?? null;

      // =========================
      // Fetch folders tree
      // =========================
      async function fetchAllFoldersTree() {
        const all = [];
        const visited = new Set();

        async function walk(parentId, depth) {
          const key = parentId == null ? "null" : String(parentId);
          if (visited.has(`${key}:${depth}`) && depth > 0) return;
          visited.add(`${key}:${depth}`);

          const url =
            parentId == null ? `${ENDPOINTS.folders}` : `${ENDPOINTS.folders}?parent_id=${encodeURIComponent(parentId)}`;

          let rows = [];
          try {
            rows = normalizeItems(await apiFetch(url));
          } catch {
            rows = [];
          }

          rows.sort((a, b) => folderNameOf(a).localeCompare(folderNameOf(b), "th"));

          for (const f of rows) {
            const id = folderIdOf(f);
            if (!id) continue;
            if (!all.find((x) => folderIdOf(x) === id)) all.push({ ...f, __depth: depth });
            await walk(id, depth + 1);
          }
        }

        await walk(null, 0);

        if (!all.length) {
          try {
            const flat = normalizeItems(await apiFetch(ENDPOINTS.folders));
            flat.forEach((f) => all.push({ ...f, __depth: 0 }));
          } catch {}
        }

        return all;
      }

      function buildFolderOptions(folders) {
        const map = new Map(); // parentId -> children[]
        const byId = new Map();

        folders.forEach((f) => {
          const id = folderIdOf(f);
          byId.set(id, f);
          const p = folderParentOf(f);
          const pid = p == null ? "" : String(p);
          if (!map.has(pid)) map.set(pid, []);
          map.get(pid).push(f);
        });

        for (const arr of map.values()) {
          arr.sort((a, b) => folderNameOf(a).localeCompare(folderNameOf(b), "th"));
        }

        const ordered = [];
        function dfs(parentKey, depth) {
          const kids = map.get(parentKey) || [];
          for (const f of kids) {
            ordered.push({ ...f, __depth: depth });
            dfs(folderIdOf(f), depth + 1);
          }
        }
        dfs("", 0);

        const lines = [];
        lines.push(`<option value="">— กรุณาเลือกแฟ้ม —</option>`);
        ordered.forEach((f) => {
          const id = folderIdOf(f);
          const name = folderNameOf(f);
          const d = Number(f.__depth || 0);
          const indent = d === 0 ? "" : `${"&nbsp;".repeat(d * 4)}└─ `;
          const badge = d === 0 ? "📁" : "📂";
          lines.push(`<option value="${esc(id)}">${indent}${badge} ${esc(name)}</option>`);
        });

        return { ordered, byId, html: lines.join("") };
      }

      // ✅ สร้าง path แฟ้ม: แฟ้มหลัก / ย่อย / ย่อย
      function buildFolderPath(byId, folderId) {
        const fid = String(folderId ?? "").trim();
        if (!fid) return "-";
        const parts = [];
        let cur = byId.get(fid);
        let guard = 0;
        while (cur && guard++ < 20) {
          parts.push(folderNameOf(cur));
          const pid = folderParentOf(cur);
          if (pid == null || pid === "" || pid === 0) break;
          cur = byId.get(String(pid));
        }
        return parts.reverse().join(" / ") || `แฟ้ม #${fid}`;
      }

      // =========================
      // Header
      // =========================
      if (pageTitle) pageTitle.textContent = "เอกสาร";
      if (pageDesc) pageDesc.textContent = routeFolderId ? `เอกสารในแฟ้ม #${routeFolderId}` : "เอกสารทั้งหมด";

      // =========================
      // Limit preference (✅ default 50, choose 50/100)
      // =========================
      const LIMIT_KEY = "docs_limit";
      const getLimit = () => {
        const v = String(localStorage.getItem(LIMIT_KEY) || "50");
        return v === "100" ? 100 : 50;
      };
      const setLimit = (n) => {
        const v = n === 100 ? "100" : "50";
        localStorage.setItem(LIMIT_KEY, v);
      };

      // =========================
      // Load folders
      // =========================
      const foldersAll = await fetchAllFoldersTree();
      const folderPack = buildFolderOptions(foldersAll);

      // =========================
      // Fetch documents with limit (✅)
      // =========================
      const makeDocsUrl = (limit) => {
        const lim = Number(limit || 50);
        if (routeFolderId) {
          return `${ENDPOINTS.documents}?folder_id=${encodeURIComponent(routeFolderId)}&limit=${encodeURIComponent(
            lim
          )}&offset=0`;
        }
        return `${ENDPOINTS.documents}?limit=${encodeURIComponent(lim)}&offset=0`;
      };

      let docsAll = [];
      let currentLimit = getLimit();

      async function reloadDocs({ silent = false } = {}) {
        if (!silent) toast("กำลังโหลดรายการเอกสาร...", "info", 1400);
        try {
          docsAll = normalizeItems(await apiFetch(makeDocsUrl(currentLimit)));
        } catch (e) {
          docsAll = [];
          toast(`โหลดเอกสารไม่สำเร็จ: ${e.message}`, "error", 4200);
        }
      }

      await reloadDocs({ silent: true });

      if (leftTitle) leftTitle.textContent = routeFolderId ? `เอกสารในแฟ้ม #${routeFolderId}` : "รายการเอกสาร";

      // =========================
      // Render (Card list)
      // =========================
      leftBody.innerHTML = `
        <div class="doc-wrap">
          <div class="doc-head">
            <div>
              <div class="doc-title">รายการเอกสาร</div>
              <div class="doc-sub">ใหม่ก่อน • ค้นหา/กรอง • ดูรายละเอียดในป๊อปอัพ “ดู”</div>

              <div class="doc-pills">
                <span class="pill">📦 ดึงมา <b id="pillCount">${docsAll.length}</b> รายการ</span>
                <span class="pill">⚙️ จำกัดที่ <b id="pillLimit">${currentLimit}</b></span>
                <span class="pill muted">* ถ้ามีมากกว่านี้ ให้เพิ่ม Limit</span>
              </div>
            </div>

            <div class="doc-tools">
              <input id="docKeyword" class="modal-input doc-input" placeholder="ค้นหา (ชื่อเอกสาร/ชื่อไฟล์)..." />

              <select id="docFolderFilter" class="modal-select doc-select">
                <option value="">ทุกแฟ้ม</option>
                ${folderPack.ordered
                  .map((f) => {
                    const id = folderIdOf(f);
                    const name = folderNameOf(f);
                    const d = Number(f.__depth || 0);
                    const indent = d === 0 ? "" : `${"&nbsp;".repeat(d * 4)}└─ `;
                    const badge = d === 0 ? "📁" : "📂";
                    return `<option value="${esc(id)}">${indent}${badge} ${esc(name)}</option>`;
                  })
                  .join("")}
              </select>

              <select id="docSort" class="modal-select doc-select" style="min-width:170px;">
                <option value="updated_desc">ล่าสุดก่อน</option>
                <option value="updated_asc">เก่าก่อน</option>
                <option value="name_asc">ชื่อ A-Z</option>
                <option value="name_desc">ชื่อ Z-A</option>
              </select>

              <select id="docLimit" class="modal-select doc-select doc-limit" style="min-width:150px;">
                <option value="50">50 รายการ</option>
                <option value="100">100 รายการ</option>
              </select>

              <button id="docRefresh" class="btn btn-ghost modern" type="button">รีเฟรช</button>
            </div>
          </div>

          <div class="doc-list" id="docList"></div>
          <div id="docFoot" class="doc-foot"></div>
        </div>

        <!-- Upload Modal (คงเดิมของคุณ) -->
        <div id="upOverlay" class="up-overlay" style="display:none">
          <div class="up-modal">
            <div class="up-head">
              <div>
                <div class="up-title">อัปโหลดเอกสาร (หลายไฟล์)</div>
                <div class="up-sub">เลือกแฟ้ม → เลือกไฟล์ → อัปโหลด</div>
              </div>
              <button id="upClose" class="iconx" type="button" aria-label="ปิด">✕</button>
            </div>

            <div class="up-body">
              <div class="up-grid">
                <div class="up-field">
                  <label class="up-label req">แฟ้มปลายทาง</label>
                  <select id="upFolder" class="modal-select doc-select">
                    ${folderPack.html}
                  </select>
                  <div class="up-help">* จำเป็นต้องเลือกแฟ้ม</div>
                </div>
              </div>

              <div class="up-box">
                <div class="up-boxHead">
                  <div class="muted">แนะนำ 30–50 ไฟล์/ครั้ง</div>
                  <div class="up-actions">
                    <input id="upFiles" type="file" multiple style="display:none" />
                    <button id="upPick" class="btn btn-primary modern" type="button">เลือกไฟล์</button>
                    <button id="upClear" class="btn btn-ghost modern" type="button">ล้างรายการ</button>
                  </div>
                </div>

                <div class="up-list">
                  <table class="up-table">
                    <thead>
                      <tr>
                        <th>ไฟล์</th>
                        <th style="width:340px;">ชื่อเอกสาร (แก้ได้)</th>
                        <th style="width:220px;">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody id="upTbody">
                      <tr><td colspan="3" class="muted" style="padding:14px;">ยังไม่ได้เลือกไฟล์</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="up-foot">
              <button id="upCancel" class="btn btn-ghost modern" type="button">ยกเลิก</button>
              <button id="upSubmit" class="btn btn-primary modern" type="button">อัปโหลด</button>
            </div>
          </div>
        </div>

        <!-- Detail Modal -->
        <div id="docModalOverlay" class="doc-modal-overlay" style="display:none">
          <div class="doc-modal">
            <div class="doc-modal__head">
              <div class="doc-modal__title" id="docModalTitle">เอกสาร</div>
              <button class="iconx" id="docModalClose" type="button" aria-label="ปิด">✕</button>
            </div>

            <div class="doc-modal__body">
              <div id="docModalMeta" class="doc-modal__meta"></div>
              <div class="doc-modal__previewWrap">
                <div class="doc-modal__previewTitle">พรีวิว</div>
                <div id="docModalPreview" class="doc-modal__preview"></div>
              </div>
            </div>

            <div class="doc-modal__foot">
              <div class="doc-modal__left">
                <button class="btn btn-ghost modern" id="docModalBack" type="button">← ปิด</button>
              </div>
              <div class="doc-modal__right">
                <button class="btn btn-ghost modern" id="docModalDownload" type="button">ดาวน์โหลด</button>
                <button class="btn btn-primary modern" id="docModalPreviewBtn" type="button">เปิดพรีวิว</button>
                <button class="btn btn-ghost danger modern" id="docModalTrash" type="button">ลบ → ถังขยะ</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const listEl = $("#docList");
      const keywordEl = $("#docKeyword");
      const folderEl = $("#docFolderFilter");
      const sortEl = $("#docSort");
      const limitEl = $("#docLimit");
      const refreshEl = $("#docRefresh");
      const footEl = $("#docFoot");

      const pillCountEl = $("#pillCount");
      const pillLimitEl = $("#pillLimit");

      if (folderEl && routeFolderId) folderEl.value = routeFolderId;

      if (limitEl) {
        limitEl.value = String(currentLimit);
        limitEl.addEventListener("change", async () => {
          const next = Number(limitEl.value) === 100 ? 100 : 50;
          currentLimit = next;
          setLimit(next);
          if (pillLimitEl) pillLimitEl.textContent = String(currentLimit);
          await reloadDocs({ silent: true });
          applyFilters(true);
          toast(`ตั้งค่า Limit เป็น ${currentLimit} รายการ`, "success", 2200);
        });
      }

      refreshEl?.addEventListener("click", async () => {
        await reloadDocs({ silent: true });
        applyFilters(true);
        toast("รีเฟรชแล้ว", "success", 1600);
      });

      // =========================
      // Upload (คงเดิมของคุณ)
      // =========================
      const upOverlay = $("#upOverlay");
      const upClose = $("#upClose");
      const upCancel = $("#upCancel");
      const upPick = $("#upPick");
      const upClear = $("#upClear");
      const upFiles = $("#upFiles");
      const upTbody = $("#upTbody");
      const upSubmit = $("#upSubmit");
      const upFolder = $("#upFolder");

      let staged = [];

      const renderUp = () => {
        if (!upTbody) return;
        if (!staged.length) {
          upTbody.innerHTML = `<tr><td colspan="3" class="muted" style="padding:14px;">ยังไม่ได้เลือกไฟล์</td></tr>`;
          return;
        }
        upTbody.innerHTML = staged
          .map(
            (x, idx) => `
            <tr>
              <td class="mono">${esc(x.file?.name || "-")}</td>
              <td><input class="modal-input up-titleInput" data-idx="${idx}" value="${esc(x.title)}" /></td>
              <td class="mono ${x.status === "สำเร็จ" ? "up-ok" : String(x.status).startsWith("ผิดพลาด") ? "up-bad" : "muted"}">
                ${esc(x.status)}
              </td>
            </tr>
          `
          )
          .join("");
      };

      const closeUp = () => {
        if (upOverlay) upOverlay.style.display = "none";
        staged = [];
        if (upFiles) upFiles.value = "";
        renderUp();
      };

      if (btnNew) {
        btnNew.textContent = "＋ เพิ่มเอกสาร";
        btnNew.onclick = () => {
          if (upOverlay) upOverlay.style.display = "flex";
          if (upFolder && routeFolderId) upFolder.value = routeFolderId;
        };
      }

      upOverlay?.addEventListener("click", (e) => {
        if (e.target === upOverlay) closeUp();
      });
      upClose?.addEventListener("click", closeUp);
      upCancel?.addEventListener("click", closeUp);

      upPick?.addEventListener("click", () => upFiles?.click());
      upClear?.addEventListener("click", () => {
        staged = [];
        if (upFiles) upFiles.value = "";
        renderUp();
        toast("ล้างรายการไฟล์แล้ว", "info");
      });

      upFiles?.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        staged = files.map((f) => ({
          file: f,
          title: f.name.replace(/\.[^.]+$/, ""),
          status: "รออัปโหลด",
        }));
        renderUp();
        toast(`เลือกไฟล์แล้ว ${files.length} ไฟล์`, "success");
      });

      leftBody.addEventListener("input", (e) => {
        const el = e.target;
        if (!el?.classList?.contains("up-titleInput")) return;
        const idx = Number(el.getAttribute("data-idx"));
        if (!Number.isInteger(idx) || !staged[idx]) return;
        staged[idx].title = el.value;
      });

      const uploadUrlPrimary = ENDPOINTS?.documentsUpload || "/api/documents/upload";
      const uploadUrlFallback = "/api/documents/upload";

      async function uploadOneFile(fd) {
        try {
          return await window.api.formFetch(uploadUrlPrimary, { method: "POST", formData: fd });
        } catch (e1) {
          if (uploadUrlPrimary !== uploadUrlFallback) {
            return await window.api.formFetch(uploadUrlFallback, { method: "POST", formData: fd });
          }
          throw e1;
        }
      }

      upSubmit?.addEventListener("click", async () => {
        const folderId = String(upFolder?.value || "").trim();
        if (!folderId) return toast("กรุณาเลือกแฟ้มปลายทางก่อนอัปโหลด", "error", 3200);
        if (!staged.length) return toast("กรุณาเลือกไฟล์ก่อน", "error", 3200);

        toast("เริ่มอัปโหลด...", "info");

        let ok = 0;
        let bad = 0;
        let lastErr = "";

        for (let i = 0; i < staged.length; i++) {
          staged[i].status = "กำลังอัปโหลด...";
          renderUp();

          const fd = new FormData();
          fd.append("file", staged[i].file);
          fd.append("folder_id", folderId);
          fd.append("title", safeVal(staged[i].title, staged[i].file?.name || "เอกสาร"));

          try {
            await uploadOneFile(fd);
            staged[i].status = "สำเร็จ";
            ok++;
          } catch (err) {
            lastErr = err?.message || "อัปโหลดไม่สำเร็จ";
            staged[i].status = `ผิดพลาด: ${lastErr}`;
            bad++;
          }
          renderUp();
        }

        if (ok && !bad) toast(`อัปโหลดสำเร็จ ${ok} ไฟล์`, "success", 3400);
        else if (ok && bad) toast(`สำเร็จ ${ok} • ไม่สำเร็จ ${bad} (เช็คสถานะในตาราง)`, "warn", 5200);
        else toast(`อัปโหลดไม่สำเร็จ: ${lastErr}`, "error", 5200);

        // รีโหลด route -> จะเด้งใหม่บนสุดตาม sort ล่าสุดก่อน
        window.dispatchEvent(new Event("force-render-route"));
      });

      // =========================
      // Detail modal
      // =========================
      const docModalOverlay = $("#docModalOverlay");
      const docModalTitle = $("#docModalTitle");
      const docModalMeta = $("#docModalMeta");
      const docModalPreview = $("#docModalPreview");
      const docModalClose = $("#docModalClose");
      const docModalBack = $("#docModalBack");
      const docModalDownload = $("#docModalDownload");
      const docModalPreviewBtn = $("#docModalPreviewBtn");
      const docModalTrash = $("#docModalTrash");

      let currentObjectUrl = null;
      const clearObjectUrl = () => {
        if (currentObjectUrl) {
          try {
            URL.revokeObjectURL(currentObjectUrl);
          } catch {}
          currentObjectUrl = null;
        }
      };

      function guessMime(name, mime) {
        const m = String(mime || "").toLowerCase();
        if (m) return m;
        const n = String(name || "").toLowerCase();
        if (n.endsWith(".pdf")) return "application/pdf";
        if (/\.(png)$/i.test(n)) return "image/png";
        if (/\.(jpe?g)$/i.test(n)) return "image/jpeg";
        if (/\.(gif)$/i.test(n)) return "image/gif";
        if (/\.(webp)$/i.test(n)) return "image/webp";
        return "";
      }

      function openDocModal(doc) {
        const id = String(getId(doc));
        const name = String(getName(doc));
        const fileName = String(getFileName(doc));
        const mime = String(getMime(doc));
        const size = fmtBytes(getSize(doc));
        const when = fmtDate(getUpdated(doc));
        const folderId = String(getFolderId(doc) ?? "");
        const folderPath = buildFolderPath(folderPack.byId, folderId);

        docModalTitle.textContent = name;
        docModalMeta.innerHTML = `
          <div class="doc-meta">
            <div><span class="doc-meta__k">แฟ้ม</span><span class="doc-meta__v">${esc(folderPath)}</span></div>
            <div><span class="doc-meta__k">ID</span><span class="doc-meta__v">${esc(id)}</span></div>
            <div><span class="doc-meta__k">ไฟล์</span><span class="doc-meta__v">${esc(fileName)}</span></div>
            <div><span class="doc-meta__k">ประเภทไฟล์</span><span class="doc-meta__v">${esc(mime)}</span></div>
            <div><span class="doc-meta__k">ขนาด</span><span class="doc-meta__v">${esc(size)}</span></div>
            <div><span class="doc-meta__k">อัปเดต</span><span class="doc-meta__v">${esc(when)}</span></div>
          </div>
        `;

        clearObjectUrl();
        docModalPreview.innerHTML = `<div class="muted">กด “เปิดพรีวิว” เพื่อแสดงไฟล์ (รองรับ PDF/รูปภาพ)</div>`;

        const downloadUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;
        const previewUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/preview`;

        docModalDownload.onclick = async () => {
          try {
            const blob = await fetchBlobWithAuth(downloadUrl);
            clearObjectUrl();
            currentObjectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = currentObjectUrl;
            a.download = name || `document-${id}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("เริ่มดาวน์โหลดแล้ว", "success");
          } catch (e) {
            toast(`ดาวน์โหลดไม่ได้: ${e.message}`, "error", 4200);
          }
        };

        docModalPreviewBtn.onclick = async () => {
          try {
            const blob = await fetchBlobWithAuth(previewUrl);
            clearObjectUrl();
            currentObjectUrl = URL.createObjectURL(blob);
            const m = guessMime(name, blob.type || doc?.mime_type);

            if (m.includes("pdf") || blob.type === "application/pdf") {
              docModalPreview.innerHTML = `<iframe class="doc-modal__iframe" src="${esc(currentObjectUrl)}" title="${esc(name)}" loading="lazy"></iframe>`;
            } else if ((m || "").startsWith("image/")) {
              docModalPreview.innerHTML = `<img class="doc-modal__img" src="${esc(currentObjectUrl)}" alt="${esc(name)}" />`;
            } else {
              docModalPreview.innerHTML = `<div class="muted">ไฟล์นี้ไม่รองรับพรีวิว กรุณากด “ดาวน์โหลด”</div>`;
              clearObjectUrl();
            }
          } catch (e) {
            docModalPreview.innerHTML = `<div class="doc-err">พรีวิวไม่ได้: ${esc(e.message)}</div>`;
          }
        };

        docModalTrash.onclick = async () => {
          if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
          try {
            await apiFetch(`${ENDPOINTS.documents}/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast("ย้ายไปถังขยะแล้ว", "success");
            clearObjectUrl();
            docModalOverlay.style.display = "none";
            window.dispatchEvent(new Event("force-render-route"));
          } catch (e) {
            toast(`ลบไม่ได้: ${e.message}`, "error", 4200);
          }
        };

        docModalOverlay.style.display = "flex";
      }

      const closeDocModal = () => {
        docModalOverlay.style.display = "none";
        clearObjectUrl();
      };
      docModalOverlay.addEventListener("click", (e) => {
        if (e.target === docModalOverlay) closeDocModal();
      });
      docModalClose.onclick = closeDocModal;
      docModalBack.onclick = closeDocModal;

      // =========================
      // List render/filter/sort
      // =========================
      const cardHtml = (d) => {
        const id = getId(d);
        const folderId = String(getFolderId(d) ?? "");
        const folderPath = buildFolderPath(folderPack.byId, folderId);
        const fileName = getFileName(d);

        return `
          <div class="doc-card" data-id="${esc(id)}">
            <div class="doc-card__main">
              <div class="doc-card__title">${esc(getName(d))}</div>
              <div class="doc-card__sub">
                <span class="chip chip-folder">📁 ${esc(folderPath)}</span>
                <span class="chip chip-file">📄 ${esc(fileName)}</span>
              </div>
            </div>

            <div class="doc-card__actions">
              <button class="btn btn-primary modern" data-act="detail" data-id="${esc(id)}" type="button">ดู</button>
              <button class="btn btn-ghost modern" data-act="download" data-id="${esc(id)}" type="button">ดาวน์โหลด</button>
              <button class="btn btn-ghost danger modern" data-act="trash" data-id="${esc(id)}" type="button">ลบ</button>
            </div>
          </div>
        `;
      };

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

      const renderCards = (rows, fullCount) => {
        listEl.innerHTML = rows.length
          ? rows.map(cardHtml).join("")
          : `<div class="doc-empty">ไม่พบเอกสาร</div>`;

        if (pillCountEl) pillCountEl.textContent = String(fullCount ?? rows.length);
        if (pillLimitEl) pillLimitEl.textContent = String(currentLimit);

        // badge/foot -> “แสดง X (จากที่ดึงมา Y/limit)”
        const pulled = Number(fullCount ?? rows.length);
        if (leftBadge) leftBadge.textContent = `${rows.length} รายการ`;
        if (footEl) {
          footEl.innerHTML = `
            แสดง <b>${rows.length}</b> รายการ
            <span class="dot">•</span>
            ดึงมา <b>${pulled}</b> / จำกัดที่ <b>${currentLimit}</b>
          `;
        }

        setUpdatedNow?.();
      };

      function bindActions(rows) {
        // click card -> open detail
        leftBody.querySelectorAll(".doc-card[data-id]").forEach((card) => {
          card.onclick = (e) => {
            if (e.target.closest("button[data-act]")) return;
            const id = card.getAttribute("data-id");
            const d = rows.find((x) => String(getId(x)) === String(id));
            if (d) openDocModal(d);
          };
        });

        // buttons
        leftBody.querySelectorAll("button[data-act]").forEach((btn) => {
          btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");
            const d = rows.find((x) => String(getId(x)) === String(id));
            if (!d) return;

            if (act === "detail") return openDocModal(d);

            if (act === "download") {
              const downloadUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;
              try {
                const blob = await fetchBlobWithAuth(downloadUrl);
                const name = String(getName(d) || `document-${id}`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                toast("เริ่มดาวน์โหลดแล้ว", "success");
              } catch (err) {
                toast(`ดาวน์โหลดไม่ได้: ${err.message}`, "error", 4200);
              }
              return;
            }

            if (act === "trash") {
              if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;
              try {
                await apiFetch(`${ENDPOINTS.documents}/${encodeURIComponent(id)}`, { method: "DELETE" });
                toast("ย้ายไปถังขยะแล้ว", "success");
                window.dispatchEvent(new Event("force-render-route"));
              } catch (err) {
                toast(`ลบไม่ได้: ${err.message}`, "error", 4200);
              }
            }
          };
        });
      }

      let debounce = null;

      const applyFilters = (noToast = false) => {
        const kw = String(keywordEl?.value || "").trim().toLowerCase();
        const fid = String(folderEl?.value || "").trim();
        const sortMode = String(sortEl?.value || "updated_desc");

        const filtered = docsAll.filter((d) => {
          const hitKw =
            !kw ||
            String(getName(d)).toLowerCase().includes(kw) ||
            String(getFileName(d)).toLowerCase().includes(kw);

          const hitFolder = !fid || String(getFolderId(d) ?? "") === String(fid);
          return hitKw && hitFolder;
        });

        const sorted = applySort(filtered, sortMode);
        renderCards(sorted, docsAll.length);
        bindActions(sorted);

        if (!noToast) setUpdatedNow?.();
      };

      const debounceApply = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => applyFilters(true), 120);
      };

      keywordEl?.addEventListener("input", debounceApply);
      folderEl?.addEventListener("change", () => applyFilters(true));
      sortEl?.addEventListener("change", () => applyFilters(true));

      // initial
      applyFilters(true);
      setUpdatedNow?.();
    },
  };
})();