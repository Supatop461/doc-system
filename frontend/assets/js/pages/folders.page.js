// frontend/assets/js/pages/folders.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.folders = {
    async load(ctx) {
      const { ENDPOINTS, $, $$, apiFetch } = ctx;

      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      // =========================
      // ✅ Pretty Error -> Thai + Alert HTML
      // =========================
      function prettyFolderError(code) {
        const map = {
          DELETE_FOLDER_NOT_EMPTY: {
            title: "ลบแฟ้มไม่ได้",
            desc:
              "แฟ้มนี้ยังมี “แฟ้มย่อย” หรือ “เอกสาร” อยู่ข้างใน\n" +
              "กรุณาย้าย/ลบของด้านในให้หมดก่อน แล้วลองใหม่อีกครั้ง",
            variant: "danger",
            icon: "⚠️",
          },
          UNAUTHORIZED: {
            title: "ไม่มีสิทธิ์ทำรายการ",
            desc: "กรุณาเข้าสู่ระบบใหม่ หรือขอสิทธิ์จากผู้ดูแลระบบ",
            variant: "danger",
            icon: "🔒",
          },
          FORBIDDEN: {
            title: "ไม่มีสิทธิ์ทำรายการ",
            desc: "บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้",
            variant: "danger",
            icon: "⛔",
          },
          NOT_FOUND: {
            title: "ไม่พบแฟ้ม",
            desc: "อาจถูกลบไปแล้ว หรือข้อมูลไม่ถูกต้อง",
            variant: "danger",
            icon: "🔎",
          },
          NO_FIELDS_TO_UPDATE: {
            title: "ไม่มีข้อมูลให้บันทึก",
            desc: "กรุณาแก้ไขข้อมูลก่อนกดบันทึก",
            variant: "danger",
            icon: "ℹ️",
          },
        };

        return (
          map[String(code || "")] || {
            title: "เกิดข้อผิดพลาด",
            desc: "ระบบไม่สามารถทำรายการได้ กรุณาลองใหม่",
            variant: "danger",
            icon: "❗",
          }
        );
      }

      function renderAlertHTML({ title, desc, variant, icon }, code) {
        const safeDesc = esc(String(desc || "")).replace(/\n/g, "<br>");
        const safeCode = code ? `<span class="alert__code">${esc(code)}</span>` : "";
        return `
          <div class="alert alert--${esc(variant || "info")}">
            <div class="alert__icon">${esc(icon || "ℹ️")}</div>
            <div class="alert__body">
              <div class="alert__title">${esc(title || "แจ้งเตือน")}</div>
              <p class="alert__desc">${safeDesc}</p>
              ${safeCode}
            </div>
          </div>
        `;
      }

      // -------------------------
      // helpers
      // -------------------------
      const setLeft = (title, badgeHtml, bodyHtml) => {
        const leftTitle = $("leftTitle");
        const leftBadge = $("leftBadge");
        const leftBody = $("leftBody");
        if (leftTitle) leftTitle.innerHTML = title || "";
        if (leftBadge) leftBadge.innerHTML = badgeHtml || "";
        if (leftBody) leftBody.innerHTML = bodyHtml || "";
      };

      // ✅ ฝั่งขวาว่างไว้
      const clearRightPanel = () => {
        const rt = $("rightTitle");
        const rh = $("rightHint");
        const rb = $("rightBody");
        if (rt) rt.innerHTML = "";
        if (rh) rh.innerHTML = "";
        if (rb) rb.innerHTML = "";
      };

      const parseItems = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        return [];
      };

      const showToast = (msg, type = "info") => {
        let box = document.getElementById("__toastBox");
        if (!box) {
          box = document.createElement("div");
          box.id = "__toastBox";
          box.style.position = "fixed";
          box.style.right = "16px";
          box.style.bottom = "16px";
          box.style.zIndex = "99999";
          box.style.display = "flex";
          box.style.flexDirection = "column";
          box.style.gap = "10px";
          document.body.appendChild(box);
        }
        const t = document.createElement("div");
        t.style.padding = "10px 12px";
        t.style.borderRadius = "12px";
        t.style.boxShadow = "0 10px 25px rgba(0,0,0,0.18)";
        t.style.border = "1px solid rgba(236,72,153,0.25)";
        t.style.background = type === "error" ? "#fee2e2" : "#fff";
        t.style.color = type === "error" ? "#991b1b" : "#831843";
        t.style.fontWeight = "800";
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => t.remove(), 2400);
      };

      // -------------------------
      // lookup caches (doc types / it jobs)
      // -------------------------
      let __docTypesCache = null;
      let __itJobsCache = null;

      const getDocTypesUrl = () =>
        ENDPOINTS?.documentTypes || "http://localhost:3000/api/document-types";

      const getItJobsUrl = () =>
        ENDPOINTS?.itJobTypes || "http://localhost:3000/api/it-job-types";

      const ensureLookupsLoaded = async () => {
        try {
          if (!__docTypesCache) __docTypesCache = parseItems(await apiFetch(getDocTypesUrl()));
        } catch {
          __docTypesCache = [];
        }
        try {
          if (!__itJobsCache) __itJobsCache = parseItems(await apiFetch(getItJobsUrl()));
        } catch {
          __itJobsCache = [];
        }
      };

      const nameByAnyIdKey = (items, id, possibleIdKeys, nameKey = "name") => {
        if (id == null || id === "") return null;
        const num = Number(id);
        for (const k of possibleIdKeys) {
          const found = (items || []).find((x) => Number(x?.[k]) === num);
          if (found?.[nameKey]) return found[nameKey];
        }
        return null;
      };

      // =========================
      // ✅ Folder Docs Modal (ใช้ modal ใน app.html)
      // =========================
      const docsModal = () => document.getElementById("folderDocsModal");
      const docsTitle = () => document.getElementById("folderDocsTitle");
      const docsBody = () => document.getElementById("folderDocsBody");

      function ensureDocsModalEvents() {
        const m = docsModal();
        if (!m || m.dataset.bound === "1") return;
        m.dataset.bound = "1";

        // คลิกพื้นหลังปิด
        m.addEventListener("click", (e) => {
          if (e.target === m) window.closeFolderDocs?.();
        });

        // ESC ปิด
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") window.closeFolderDocs?.();
        });
      }

      // ✅ เก็บ state เพื่อกลับไป popup รายละเอียดแฟ้ม
      window.__restoreFolderDetail = null;

      window.closeFolderDocs = function closeFolderDocs() {
        const m = docsModal();
        if (!m) return;

        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");

        // ✅ กลับไป popup รายละเอียดแฟ้ม (ถ้ามี)
        if (typeof window.__restoreFolderDetail === "function") {
          const fn = window.__restoreFolderDetail;
          window.__restoreFolderDetail = null;
          fn();
        }
      };

      window.openFolderDocs = async function openFolderDocs(folderId, folderName) {
        ensureDocsModalEvents();
        const m = docsModal();
        if (!m) {
          showToast("ไม่พบ modal เอกสารในแฟ้ม (folderDocsModal)", "error");
          return;
        }

        m.classList.remove("hidden");
        m.setAttribute("aria-hidden", "false");

        if (docsTitle()) docsTitle().textContent = `เอกสารในแฟ้ม: ${folderName || "-"}`;
        if (docsBody()) docsBody().innerHTML = `<tr><td colspan="3">กำลังโหลด…</td></tr>`;

        const base = (ENDPOINTS?.documents || "http://localhost:3000/api/documents").replace(/\/$/, "");
        const url = `${base}?folder_id=${encodeURIComponent(folderId)}`;

        try {
          const raw = await apiFetch(url);
          const items = parseItems(raw);

          if (!items || items.length === 0) {
            docsBody().innerHTML = `<tr><td colspan="3">ไม่มีเอกสารในแฟ้มนี้</td></tr>`;
            return;
          }

          docsBody().innerHTML = items
            .map((d) => {
              const id = d.document_id ?? d.id ?? d.documentId;
              const name = d.title || d.original_file_name || d.originalFileName || `เอกสาร #${id}`;
              const mime = d.mime_type || d.mimeType || "-";
              const downloadUrl = `${base}/${encodeURIComponent(id)}/download`;

              // ✅ preview ใช้ download ไปก่อน (ถ้าคุณมี /preview ค่อยเปลี่ยน)
              const previewUrl = downloadUrl;

              return `
                <tr class="doc-row">
                  <td>${esc(name)}</td>
                  <td>${esc(mime)}</td>
                  <td>
                    <div class="doc-actions">
                      <button type="button" class="btn-mini btn-preview"
                        onclick="window.open('${previewUrl}','_blank')">👁 พรีวิว</button>
                      <button type="button" class="btn-mini btn-download"
                        onclick="window.location.href='${downloadUrl}'">⬇ ดาวน์โหลด</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("");
        } catch (e) {
          docsBody().innerHTML = `<tr><td colspan="3">โหลดเอกสารไม่สำเร็จ</td></tr>`;
          showToast(e?.message || "โหลดเอกสารไม่สำเร็จ", "error");
        }
      };

      // -------------------------
      // Modal: Folder Detail (✅ เพิ่มปุ่ม “เอกสารในแฟ้ม” + ตัดข้อความล่าง)
      // -------------------------
      const ensureDetailModal = () => {
        let overlay = document.getElementById("folderDetailModal");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "folderDetailModal";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.display = "none";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.background = "rgba(0,0,0,0.35)";
        overlay.style.zIndex = "99999";
        overlay.innerHTML = `
          <div style="width:min(640px, 92vw); background:#fff; border-radius:18px; border:1px solid rgba(236,72,153,.25); box-shadow:0 18px 60px rgba(0,0,0,.25); overflow:hidden;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.06);">
              <h3 style="margin:0; font-size:16px; color:#831843; font-weight:900;">รายละเอียดแฟ้ม</h3>
              <button id="fdClose" type="button" class="btn btn-ghost" style="border-radius:12px;">✕</button>
            </div>

            <div style="padding:14px 16px;">
              <div id="fdError" style="display:none; margin-bottom:12px;"></div>
              <div id="fdBody"></div>
            </div>

            <div style="display:flex; justify-content:space-between; gap:10px; padding:12px 16px; border-top:1px solid rgba(0,0,0,.06); flex-wrap:wrap;">
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="fdDocs" type="button" class="btn btn-primary">📄 เอกสารในแฟ้ม</button>
                <button id="fdCreateChild" type="button" class="btn btn-primary">+ เพิ่มแฟ้มย่อย</button>
                <button id="fdDelete" type="button" class="btn btn-ghost" style="color:#b91c1c;">ลบแฟ้ม</button>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="fdSave" type="button" class="btn btn-primary">บันทึกการแก้ไข</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const close = () => (overlay.style.display = "none");
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close();
        });
        overlay.querySelector("#fdClose").addEventListener("click", close);
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") close();
        });

        return overlay;
      };

      const openDetailModal = async ({ folder, allFolders, onAfterChange }) => {
        const overlay = ensureDetailModal();
        const err = overlay.querySelector("#fdError");
        const body = overlay.querySelector("#fdBody");

        err.style.display = "none";
        err.innerHTML = "";

        await ensureLookupsLoaded();

        const id = folder.__id;
        const pid = folder.parent_id ?? folder.parentId ?? null;

        const docTypeId =
          folder.document_type_id ?? folder.documentTypeId ?? folder.document_type ?? null;
        const itJobId =
          folder.it_job_type_id ?? folder.itJobTypeId ?? folder.it_job ?? null;

        const prefix = folder.doc_prefix ?? folder.prefix ?? "";
        const desc = folder.description ?? folder.desc ?? "";

        const docTypeName =
          nameByAnyIdKey(__docTypesCache, docTypeId, ["document_type_id", "id", "documentTypeId"], "name") ||
          folder.document_type_name ||
          folder.documentTypeName ||
          "ไม่ระบุ";

        const itJobName =
          nameByAnyIdKey(__itJobsCache, itJobId, ["it_job_type_id", "id", "itJobTypeId"], "name") ||
          folder.it_job_type_name ||
          folder.itJobTypeName ||
          "ไม่ระบุ";

        const docTypeOptions = [`<option value="">(ไม่ระบุ)</option>`]
          .concat(
            (__docTypesCache || []).map((x) => {
              const vid = x?.document_type_id ?? x?.id;
              const nm = x?.name ?? "-";
              const sel = Number(vid) === Number(docTypeId) ? "selected" : "";
              return `<option value="${esc(vid)}" ${sel}>${esc(nm)}</option>`;
            })
          )
          .join("");

        const itJobOptions = [`<option value="">(ไม่ระบุ)</option>`]
          .concat(
            (__itJobsCache || []).map((x) => {
              const vid = x?.it_job_type_id ?? x?.id;
              const nm = x?.name ?? "-";
              const sel = Number(vid) === Number(itJobId) ? "selected" : "";
              return `<option value="${esc(vid)}" ${sel}>${esc(nm)}</option>`;
            })
          )
          .join("");

        body.innerHTML = `
          <div style="display:grid; gap:12px; line-height:1.75;">
            <div style="display:flex; align-items:flex-start; gap:10px;">
              <div style="width:38px; height:38px; border-radius:14px; display:grid; place-items:center; background:rgba(236,72,153,.10); border:1px solid rgba(236,72,153,.20);">
                <span style="font-size:18px;">📁</span>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:950; color:#831843; font-size:16px;">
                  <input id="fdName" value="${esc(folder.name || "")}"
                    style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15); font-weight:900; color:#831843;" />
                </div>
                <div class="muted" style="margin-top:6px; font-size:12px;">
                  ID: ${esc(id)} ${pid == null ? "• แฟ้มหลัก" : `• Parent: ${esc(pid)}`}
                </div>
              </div>
            </div>

            <div style="height:1px; background:rgba(0,0,0,.06);"></div>

            <div style="display:grid; gap:10px;">
              <div style="display:grid; gap:6px;">
                <div style="font-weight:900; color:#4b0030;">ประเภทเอกสาร</div>
                <select id="fdDocType" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);">
                  ${docTypeOptions}
                </select>
                <div class="muted" style="font-size:12px;">ปัจจุบัน: <b>${esc(docTypeName)}</b></div>
              </div>

              <div style="display:grid; gap:6px;">
                <div style="font-weight:900; color:#4b0030;">งาน IT</div>
                <select id="fdItJob" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);">
                  ${itJobOptions}
                </select>
                <div class="muted" style="font-size:12px;">ปัจจุบัน: <b>${esc(itJobName)}</b></div>
              </div>

              <div style="display:grid; gap:6px;">
                <div style="font-weight:900; color:#4b0030;">Prefix เลขเอกสาร</div>
                <input id="fdPrefix" value="${esc(prefix)}"
                  style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);" />
              </div>

              <div style="display:grid; gap:6px;">
                <div style="font-weight:900; color:#4b0030;">คำอธิบาย</div>
                <textarea id="fdDesc" rows="4"
                  style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15); resize:vertical;">${esc(desc)}</textarea>
              </div>
            </div>
          </div>
        `;

        overlay.style.display = "flex";

        // ✅ ปุ่มเอกสารในแฟ้ม (สำคัญ: ซ่อนรายละเอียดก่อน แล้วค่อยเปิด popup เอกสาร)
        overlay.querySelector("#fdDocs").onclick = async () => {
          const currentName = String(overlay.querySelector("#fdName")?.value || folder.name || "")
            .trim() || "-";

          // ซ่อน popup รายละเอียดแฟ้มไว้ก่อน (แก้ปัญหาไปโผล่ด้านล่าง/ทับกัน)
          overlay.style.display = "none";

          // ตั้ง callback ให้กลับมาแสดงรายละเอียดแฟ้มเมื่อปิด popup เอกสาร
          window.__restoreFolderDetail = () => {
            overlay.style.display = "flex";
          };

          await window.openFolderDocs?.(String(id), currentName);
        };

        overlay.querySelector("#fdCreateChild").onclick = () => {
          overlay.style.display = "none";
          openModal({ parents: allFolders, currentParentId: String(id) });
        };

        overlay.querySelector("#fdDelete").onclick = async () => {
          const currentName = overlay.querySelector("#fdName")?.value || folder.name || "";
          if (!confirm(`ยืนยันลบแฟ้ม "${currentName}" ?`)) return;

          err.style.display = "none";
          err.innerHTML = "";

          try {
            await apiFetch(`${ENDPOINTS.folders}/${id}`, { method: "DELETE" });
            showToast("🗑️ ลบแฟ้มแล้ว");
            overlay.style.display = "none";
            await onAfterChange?.();
          } catch (e) {
            const code =
              e?.code ||
              e?.data?.code ||
              e?.data?.error ||
              e?.data?.message ||
              e?.message ||
              "UNKNOWN_ERROR";

            const pretty = prettyFolderError(code);
            err.innerHTML = renderAlertHTML(pretty, code);
            err.style.display = "block";
            showToast(pretty.title, "error");
          }
        };

        overlay.querySelector("#fdSave").onclick = async () => {
          err.style.display = "none";
          err.innerHTML = "";

          const newName = String(overlay.querySelector("#fdName")?.value || "").trim();
          const newDocType = overlay.querySelector("#fdDocType")?.value || "";
          const newItJob = overlay.querySelector("#fdItJob")?.value || "";
          const newPrefix = String(overlay.querySelector("#fdPrefix")?.value || "").trim();
          const newDesc = String(overlay.querySelector("#fdDesc")?.value || "").trim();

          if (!newName) {
            err.innerHTML = renderAlertHTML(
              { title: "กรุณากรอกชื่อแฟ้ม", desc: "ชื่อแฟ้มห้ามว่าง", variant: "danger", icon: "✍️" },
              "VALIDATION"
            );
            err.style.display = "block";
            return;
          }

          const bodyPatch = {
            name: newName,
            document_type_id: newDocType ? Number(newDocType) : null,
            it_job_type_id: newItJob ? Number(newItJob) : null,
            doc_prefix: newPrefix || null,
            description: newDesc || null,
          };

          try {
            await apiFetch(`${ENDPOINTS.folders}/${id}`, { method: "PATCH", body: bodyPatch });
            showToast("✅ บันทึกการแก้ไขแล้ว");
            overlay.style.display = "none";
            await onAfterChange?.();
          } catch (e) {
            const code =
              e?.code ||
              e?.data?.code ||
              e?.data?.error ||
              e?.data?.message ||
              e?.message ||
              "UNKNOWN_ERROR";

            const pretty = prettyFolderError(code);
            err.innerHTML = renderAlertHTML(pretty, code);
            err.style.display = "block";
            showToast(pretty.title, "error");
          }
        };
      };

      // -------------------------
      // Modal: Create Folder (ของเดิมคุณ)
      // -------------------------
      const ensureModal = () => {
        let overlay = document.getElementById("createFolderModal");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "createFolderModal";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.display = "none";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.background = "rgba(0,0,0,0.35)";
        overlay.style.zIndex = "99999";
        overlay.innerHTML = `
          <div style="width:min(520px, 92vw); background:#fff; border-radius:18px; border:1px solid rgba(236,72,153,.25); box-shadow:0 18px 60px rgba(0,0,0,.25); overflow:hidden;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.06);">
              <h3 style="margin:0; font-size:16px; color:#831843; font-weight:900;">สร้างแฟ้มเอกสาร</h3>
              <button id="cfClose" type="button" class="btn btn-ghost" style="border-radius:12px;">✕</button>
            </div>

            <div style="padding:14px 16px;">
              <div id="cfError" style="display:none; padding:10px 12px; border-radius:12px; background:#fee2e2; color:#991b1b; font-weight:800; margin-bottom:12px;"></div>

              <label for="cfParent" style="display:block; font-weight:800; color:#831843; margin:10px 0 6px;">เลือกแฟ้มหลัก (ถ้าต้องการเพิ่มเป็นแฟ้มย่อย)</label>
              <select id="cfParent" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);">
                <option value="">(ไม่มี) สร้างเป็นแฟ้มหลัก</option>
              </select>

              <label for="cfName" style="display:block; font-weight:800; color:#831843; margin:12px 0 6px;">ชื่อแฟ้ม <span style="color:#ef4444;">*</span></label>
              <input id="cfName" type="text"
                style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);" />

              <label for="cfDocType" style="display:block; font-weight:800; color:#831843; margin:12px 0 6px;">ประเภทเอกสาร</label>
              <select id="cfDocType" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);">
                <option value="">กำลังโหลด…</option>
              </select>

              <label for="cfItJob" style="display:block; font-weight:800; color:#831843; margin:12px 0 6px;">งาน IT</label>
              <select id="cfItJob" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);">
                <option value="">กำลังโหลด…</option>
              </select>

              <label for="cfPrefix" style="display:block; font-weight:800; color:#831843; margin:12px 0 6px;">Prefix เลขเอกสาร (ถ้ามี)</label>
              <input id="cfPrefix" type="text"
                style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15);" />

              <label for="cfDesc" style="display:block; font-weight:800; color:#831843; margin:12px 0 6px;">คำอธิบาย (ถ้ามี)</label>
              <textarea id="cfDesc" rows="3"
                style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(0,0,0,.15); resize:vertical;"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; padding:12px 16px; border-top:1px solid rgba(0,0,0,.06);">
              <button id="cfCancel" type="button" class="btn btn-ghost">ยกเลิก</button>
              <button id="cfSave" type="button" class="btn btn-primary">บันทึก</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const close = () => (overlay.style.display = "none");
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close();
        });
        overlay.querySelector("#cfClose").addEventListener("click", close);
        overlay.querySelector("#cfCancel").addEventListener("click", close);
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") close();
        });
        return overlay;
      };

      const openModal = async ({ parents = [], currentParentId = "" } = {}) => {
        const overlay = ensureModal();

        const selParent = overlay.querySelector("#cfParent");
        const name = overlay.querySelector("#cfName");
        const err = overlay.querySelector("#cfError");

        const selDocType = overlay.querySelector("#cfDocType");
        const selItJob = overlay.querySelector("#cfItJob");
        const inputPrefix = overlay.querySelector("#cfPrefix");
        const inputDesc = overlay.querySelector("#cfDesc");

        err.style.display = "none";
        err.textContent = "";
        name.value = "";
        inputPrefix.value = "";
        inputDesc.value = "";

        selParent.innerHTML = `<option value="">(ไม่มี) สร้างเป็นแฟ้มหลัก</option>`;
        parents.forEach((f) => {
          const id = f.folder_id ?? f.id ?? f.folderId ?? f.__id;
          const nm = f.name ?? "";
          const opt = document.createElement("option");
          opt.value = String(id);
          opt.textContent = nm;
          selParent.appendChild(opt);
        });
        if (currentParentId) selParent.value = String(currentParentId);

        const fillSelect = (selectEl, items, valueKey, labelKey) => {
          selectEl.innerHTML = `<option value="">(ไม่ระบุ)</option>`;
          items.forEach((x) => {
            const opt = document.createElement("option");
            opt.value = String(x[valueKey]);
            opt.textContent = x[labelKey];
            selectEl.appendChild(opt);
          });
        };

        try {
          const [docTypesRaw, itJobsRaw] = await Promise.all([
            apiFetch(getDocTypesUrl()),
            apiFetch(getItJobsUrl()),
          ]);
          fillSelect(selDocType, parseItems(docTypesRaw), "document_type_id", "name");
          fillSelect(selItJob, parseItems(itJobsRaw), "it_job_type_id", "name");
        } catch {
          selDocType.innerHTML = `<option value="">โหลดประเภทเอกสารไม่สำเร็จ</option>`;
          selItJob.innerHTML = `<option value="">โหลดงาน IT ไม่สำเร็จ</option>`;
        }

        overlay.style.display = "flex";

        overlay.querySelector("#cfSave").onclick = async () => {
          try {
            const folderName = String(name.value || "").trim();
            const parent_id = selParent.value ? Number(selParent.value) : null;
            if (!folderName) {
              err.textContent = "กรุณากรอกชื่อแฟ้ม";
              err.style.display = "block";
              name.focus();
              return;
            }

            const document_type_id = selDocType.value ? Number(selDocType.value) : null;
            const it_job_type_id = selItJob.value ? Number(selItJob.value) : null;
            const doc_prefix = String(inputPrefix.value || "").trim() || null;
            const description = String(inputDesc.value || "").trim() || null;

            await apiFetch(ENDPOINTS.folders, {
              method: "POST",
              body: {
                name: folderName,
                parent_id,
                document_type_id,
                it_job_type_id,
                doc_prefix,
                description,
              },
            });

            overlay.style.display = "none";
            showToast("✅ สร้างแฟ้มสำเร็จ");
            await render();
          } catch (e) {
            err.textContent = e?.message || "บันทึกไม่สำเร็จ";
            err.style.display = "block";
          }
        };

        setTimeout(() => name.focus(), 30);
      };

      // -------------------------
      // Tree helpers
      // -------------------------
      const getId = (f) => f.folder_id ?? f.id ?? f.folderId;
      const getPid = (f) => f.parent_id ?? f.parentId ?? null;

      const EXP_KEY = "__folders_expanded_v2";
      const expanded = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem(EXP_KEY) || "[]");
        if (Array.isArray(saved)) saved.forEach((x) => expanded.add(String(x)));
      } catch {}

      const persistExpanded = () => {
        try {
          localStorage.setItem(EXP_KEY, JSON.stringify(Array.from(expanded)));
        } catch {}
      };

      const buildTree = (items) => {
        const nodes = new Map();
        items.forEach((f) => {
          const id = getId(f);
          if (id == null) return;
          nodes.set(String(id), { ...f, __id: String(id), children: [] });
        });

        const roots = [];
        nodes.forEach((node) => {
          const pid = getPid(node);
          if (pid == null || pid === "") roots.push(node);
          else {
            const parent = nodes.get(String(pid));
            if (parent) parent.children.push(node);
            else roots.push(node);
          }
        });

        const sortRec = (arr) => {
          arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
          arr.forEach((x) => sortRec(x.children));
        };
        sortRec(roots);
        return roots;
      };

      const renderNode = (node, level = 0) => {
        const hasChildren = (node.children || []).length > 0;
        const isOpen = expanded.has(node.__id);
        const pad = 12 + level * 18;

        return `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="tree-node" data-id="${esc(node.__id)}"
              style="display:flex; align-items:center; gap:10px; padding:10px 12px 10px ${pad}px;
                     border-radius:16px; border:1px solid rgba(236,72,153,.18); background:#fff;">
              <button type="button" data-toggle="${esc(node.__id)}"
                style="width:30px; height:30px; border-radius:12px; border:1px solid rgba(0,0,0,.12); background:#fff;
                       cursor:${hasChildren ? "pointer" : "default"}; opacity:${hasChildren ? "1" : ".35"};">
                ${hasChildren ? (isOpen ? "▾" : "▸") : "•"}
              </button>

              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:16px;">📁</span>
                  <div style="font-weight:900; color:#831843; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${esc(node.name || "-")}
                  </div>
                  <span class="muted" style="font-size:12px;">ID: ${esc(node.__id)}</span>
                </div>
              </div>

              <button type="button" class="btn btn-ghost" data-detail="${esc(node.__id)}">รายละเอียด</button>
              <button type="button" class="btn btn-ghost" data-create-child="${esc(node.__id)}">เพิ่มแฟ้มย่อย</button>
            </div>

            ${
              hasChildren && isOpen
                ? `<div style="display:flex; flex-direction:column; gap:10px;">
                    ${node.children.map((c) => renderNode(c, level + 1)).join("")}
                   </div>`
                : ""
            }
          </div>
        `;
      };

      // -------------------------
      // Render
      // -------------------------
      const render = async () => {
        const rawAll = await apiFetch(`${ENDPOINTS.folders}?all=1`);
        const allFolders = parseItems(rawAll);
        const roots = buildTree(allFolders);

        const titleHtml = `
          <div>
            <div style="font-size:34px; font-weight:900; color:#831843; line-height:1.1;">รายการแฟ้ม</div>
            <div style="opacity:.75; margin-top:6px;">คลิกแฟ้มเพื่อเปิดรายละเอียด แล้วกด “เอกสารในแฟ้ม”</div>
          </div>
        `;

        const badgeHtml = `<span class="badge">${allFolders.length} รายการ</span>`;

        const bodyHtml =
          roots.length === 0
            ? `
              <div style="padding:16px; background:#fff; border:1px solid rgba(236,72,153,.18); border-radius:18px;">
                <div style="font-weight:900; color:#831843; margin-bottom:6px;">ยังไม่มีแฟ้ม</div>
                <div style="opacity:.75;">กดปุ่ม “＋ เพิ่มแฟ้ม” ด้านบนเพื่อสร้างแฟ้ม</div>
              </div>
            `
            : `
              <div style="background:#fff; border:1px solid rgba(236,72,153,.18); border-radius:18px; overflow:hidden;">
                <div style="padding:12px 14px; border-bottom:1px solid rgba(0,0,0,.06);">
                  <div style="font-weight:900; color:#831843;">รายการแฟ้ม</div>
                  <div class="muted" style="margin-top:2px;">กด “รายละเอียด” เพื่อแก้ไข • ปุ่ม “เอกสารในแฟ้ม” อยู่ในหน้ารายละเอียด</div>
                </div>
                <div style="padding:12px 14px; display:flex; flex-direction:column; gap:12px;">
                  ${roots.map((r) => renderNode(r, 0)).join("")}
                </div>
              </div>
            `;

        setLeft(titleHtml, badgeHtml, bodyHtml);
        clearRightPanel();

        // ปุ่มเพิ่มแฟ้ม (บนหัว)
        const btnNew = $("btnNew");
        if (btnNew && btnNew.dataset.boundFoldersTree !== "1") {
          btnNew.dataset.boundFoldersTree = "1";
          btnNew.textContent = "＋ เพิ่มแฟ้ม";
          btnNew.classList.add("btn", "btn-primary");
          btnNew.addEventListener("click", () => openModal({ parents: allFolders, currentParentId: "" }));
        }

        // toggle
        $$("[data-toggle]").forEach((b) => {
          if (b.dataset.boundToggle === "1") return;
          b.dataset.boundToggle = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-toggle");
            if (!id) return;
            if (expanded.has(id)) expanded.delete(id);
            else expanded.add(id);
            persistExpanded();
            render();
          });
        });

        // create child
        $$("[data-create-child]").forEach((b) => {
          if (b.dataset.boundCreateChild === "1") return;
          b.dataset.boundCreateChild = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-create-child");
            openModal({ parents: allFolders, currentParentId: String(id) });
          });
        });

        // detail popup button
        $$("[data-detail]").forEach((b) => {
          if (b.dataset.boundDetail === "1") return;
          b.dataset.boundDetail = "1";
          b.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-detail");
            const folder = allFolders.find((x) => String(getId(x)) === String(id));
            if (!folder) return;

            await openDetailModal({
              folder: { ...folder, __id: String(getId(folder)) },
              allFolders,
              onAfterChange: render,
            });
          });
        });

        // ✅ คลิกทั้งแถว -> เปิดรายละเอียดแฟ้ม
        $$(".tree-node").forEach((row) => {
          if (row.dataset.boundRowClick === "1") return;
          row.dataset.boundRowClick = "1";
          row.addEventListener("click", async (e) => {
            if (e.target?.closest("button")) return;

            const id = row.getAttribute("data-id");
            if (!id) return;

            const folder = allFolders.find((x) => String(getId(x)) === String(id));
            if (!folder) return;

            await openDetailModal({
              folder: { ...folder, __id: String(getId(folder)) },
              allFolders,
              onAfterChange: render,
            });
          });
        });
      };

      await render();
    },
  };
})();