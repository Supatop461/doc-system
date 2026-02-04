// frontend/assets/js/pages/folders.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.folders = {
    async load(ctx) {
      const { ENDPOINTS, $, $$, apiFetch, applyRoute } = ctx;

      // -------------------------
      // Helpers
      // -------------------------
      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

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

      const setLeft = (title, badgeHtml, bodyHtml) => {
        const leftTitle = $("leftTitle");
        const leftBadge = $("leftBadge");
        const leftBody = $("leftBody");

        if (leftTitle) leftTitle.innerHTML = title || "";
        if (leftBadge) leftBadge.innerHTML = badgeHtml || "";
        if (leftBody) leftBody.innerHTML = bodyHtml || "";
      };

      const setDetail = (html) => {
        const d = $("detailPanel");
        if (d) d.innerHTML = html || `<div class="muted">คลิกรายการเพื่อดูรายละเอียด</div>`;
      };

      const parseItems = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        return [];
      };

      const showToast = (msg, type = "info") => {
        // toast เบา ๆ ไม่พึ่ง lib
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
        t.style.boxShadow = "0 10px 25px rgba(0,0,0,.18)";
        t.style.border = "1px solid rgba(236,72,153,.25)";
        t.style.background = type === "error" ? "#fee2e2" : "#fff";
        t.style.color = type === "error" ? "#991b1b" : "#831843";
        t.style.fontWeight = "700";
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => t.remove(), 2200);
      };

      // -------------------------
      // Modal (Create Folder)
      // -------------------------
      const ensureModal = () => {
        let overlay = document.getElementById("createFolderModal");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "createFolderModal";
        overlay.className = "folder-modal-overlay";
        overlay.innerHTML = `
          <div class="folder-modal" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
            <div class="folder-modal-header">
              <h3 id="cfTitle">สร้างแฟ้มเอกสาร</h3>
              <button id="cfClose" type="button" class="btn ghost" style="border-radius:12px;">✕</button>
            </div>

            <div class="folder-modal-body">
              <div class="folder-error" id="cfError"></div>

              <label for="cfParent">เลือกแฟ้มแม่ (ถ้าต้องการเป็นแฟ้มย่อย)</label>
              <select id="cfParent">
                <option value="">(ไม่มี) สร้างเป็นแฟ้มหลัก</option>
              </select>
              <div style="opacity:.75; margin-top:-10px; margin-bottom:14px; font-size:12px;">
                ถ้าเลือกแฟ้มแม่ ระบบจะสร้างเป็นแฟ้มย่อยอัตโนมัติ (ซ้อนได้)
              </div>

              <label for="cfName">ชื่อแฟ้ม <span style="color:#ef4444;">*</span></label>
              <input id="cfName" type="text" placeholder="เช่น ขอใช้งาน / ออร์เดอร์ / พยาบาล" />

              <!-- ช่องต่อยอดตามเดโม่ (ยังไม่ผูก DB ตอนนี้ แต่ UI พร้อม) -->
              <label for="cfDocType">ประเภทเอกสาร (ยังไม่ผูก DB)</label>
              <select id="cfDocType" disabled>
                <option>เลือกประเภทเอกสาร</option>
              </select>

              <label for="cfItJob">งาน IT (ยังไม่ผูก DB)</label>
              <select id="cfItJob" disabled>
                <option>เลือกงาน IT</option>
              </select>

              <label for="cfPrefix">Prefix เลขเอกสาร (ถ้ามี)</label>
              <input id="cfPrefix" type="text" placeholder="เช่น SYS, NET, DB" disabled />

              <label for="cfDesc">คำอธิบาย (ถ้ามี)</label>
              <textarea id="cfDesc" rows="3" placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)" style="
                width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(0,0,0,.15);
                resize: vertical;
              " disabled></textarea>
            </div>

            <div class="folder-modal-footer">
              <button id="cfCancel" type="button" class="btn ghost">ยกเลิก</button>
              <button id="cfSave" type="button" class="btn primary">บันทึก</button>
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

        return overlay;
      };

      const openModal = async ({ parents = [], currentParentId = "" } = {}) => {
        const overlay = ensureModal();
        const sel = overlay.querySelector("#cfParent");
        const name = overlay.querySelector("#cfName");
        const err = overlay.querySelector("#cfError");

        // reset
        err.style.display = "none";
        err.textContent = "";
        name.value = "";

        // fill parents
        sel.innerHTML = `<option value="">(ไม่มี) สร้างเป็นแฟ้มหลัก</option>`;
        parents.forEach((f) => {
          const id = f.folder_id ?? f.id ?? f.folderId;
          const nm = f.name ?? "";
          const opt = document.createElement("option");
          opt.value = String(id);
          opt.textContent = nm;
          sel.appendChild(opt);
        });

        // default parent = currentParentId (สร้างในโฟลเดอร์ที่กำลังเปิด)
        if (currentParentId) sel.value = String(currentParentId);

        overlay.style.display = "flex";

        const saveBtn = overlay.querySelector("#cfSave");
        saveBtn.onclick = async () => {
          try {
            const folderName = String(name.value || "").trim();
            const parent_id = sel.value ? Number(sel.value) : null;

            if (!folderName) {
              err.textContent = "กรุณากรอกชื่อแฟ้ม";
              err.style.display = "block";
              name.focus();
              return;
            }

            // POST /folders
            await apiFetch(ENDPOINTS.folders, {
              method: "POST",
              body: { name: folderName, parent_id },
            });

            overlay.style.display = "none";
            showToast("✅ สร้างแฟ้มสำเร็จ");
            await render(); // reload list
          } catch (e) {
            err.textContent = e?.message || "บันทึกไม่สำเร็จ";
            err.style.display = "block";
          }
        };

        // focus
        setTimeout(() => name.focus(), 30);
      };

      // -------------------------
      // Render
      // -------------------------
      const render = async () => {
        const q = getHashQuery();
        const parent_id = q.parent_id ? Number(q.parent_id) : null;

        // load folders (current)
        const url = parent_id ? `${ENDPOINTS.folders}?parent_id=${parent_id}` : ENDPOINTS.folders;
        const raw = await apiFetch(url);
        const folders = parseItems(raw);

        // load parents for modal dropdown (เอา root มาเลือกเป็นแม่ได้)
        const rawRoot = await apiFetch(ENDPOINTS.folders);
        const rootFolders = parseItems(rawRoot);

        // title row + add button
        const titleHtml = `
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-size:34px; font-weight:900; color:#831843; line-height:1.1;">แฟ้มเอกสาร</div>
              <div style="opacity:.75; margin-top:6px;">จัดการแฟ้มเอกสารและเอกสารภายในระบบ</div>
            </div>
            <button id="btnAddFolder" class="btn primary" type="button" style="height:42px; padding:0 16px; border-radius:14px;">
              + เพิ่มใหม่
            </button>
          </div>
        `;

        const badgeHtml = `
          <span class="pill">${folders.length} รายการ</span>
          ${parent_id ? `<span class="pill ghost" style="cursor:pointer;" id="btnBackRoot">← กลับแฟ้มหลัก</span>` : ""}
        `;

        const listHtml =
          folders.length === 0
            ? `<div class="empty">
                 <div style="font-weight:900; color:#831843; margin-bottom:4px;">ยังไม่มีแฟ้มในระดับนี้</div>
                 <div style="opacity:.75;">กด “+ เพิ่มใหม่” เพื่อสร้างแฟ้ม</div>
               </div>`
            : `
              <div class="card">
                <div class="card-head">
                  <div style="font-weight:900; color:#831843;">รายการแฟ้ม</div>
                  <div class="muted">คลิกเพื่อดูรายละเอียดในแผงขวา</div>
                </div>
                <div class="folder-list">
                  ${folders
                    .map((f) => {
                      const id = f.folder_id ?? f.id ?? f.folderId;
                      const nm = f.name ?? "-";
                      return `
                        <button class="folder-row" type="button" data-id="${esc(id)}" data-name="${esc(nm)}">
                          <div class="folder-left">
                            <span class="folder-ico">📁</span>
                            <div class="folder-meta">
                              <div class="folder-name">${esc(nm)}</div>
                              <div class="folder-sub muted">ID: ${esc(id)}</div>
                            </div>
                          </div>
                          <div class="folder-actions">
                            <button class="btn ghost sm" type="button" data-open="${esc(id)}">เปิด</button>
                            <button class="btn ghost sm" type="button" data-child="${esc(id)}">แฟ้มย่อย</button>
                          </div>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `;

        setLeft(titleHtml, badgeHtml, listHtml);

        // default detail
        setDetail(`
          <div style="font-weight:900; color:#831843; margin-bottom:6px;">รายละเอียด</div>
          <div class="muted">คลิกแถวเพื่อดูรายละเอียด</div>
        `);

        // wire add
        const btnAdd = $("#btnAddFolder");
        if (btnAdd) {
          btnAdd.onclick = () => openModal({ parents: rootFolders, currentParentId: parent_id ? String(parent_id) : "" });
        }

        // back root
        const btnBackRoot = $("#btnBackRoot");
        if (btnBackRoot) btnBackRoot.onclick = () => applyRoute("#folders");

        // row click -> detail
        $$(".folder-row").forEach((row) => {
          row.addEventListener("click", (e) => {
            // ถ้ากดปุ่มย่อย/เปิด อย่าให้ชน row click
            const t = e.target;
            if (t && (t.closest("[data-open]") || t.closest("[data-child]"))) return;

            const id = row.getAttribute("data-id");
            const name = row.getAttribute("data-name");

            setDetail(`
              <div style="font-weight:900; color:#831843; margin-bottom:10px;">รายละเอียดแฟ้ม</div>
              <div class="kv">
                <div class="k">ชื่อแฟ้ม</div><div class="v">${esc(name)}</div>
                <div class="k">ID</div><div class="v">${esc(id)}</div>
                <div class="k">ระดับ</div><div class="v">${parent_id ? "แฟ้มย่อย" : "แฟ้มหลัก"}</div>
              </div>
              <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn primary" type="button" id="btnOpenFolder">เปิดดูแฟ้มย่อย</button>
                <button class="btn ghost" type="button" id="btnCreateChild">สร้างแฟ้มย่อย</button>
              </div>
              <div style="margin-top:14px; padding:12px; border-radius:14px; background:#fff; border:1px solid rgba(236,72,153,.18);">
                <div style="font-weight:900; color:#831843; margin-bottom:4px;">หมายเหตุ</div>
                <div class="muted">
                  ตอนนี้เอกสารถูกแสดงใน “เอกสารทั้งหมด” ตามข้อมูลในตาราง documents<br/>
                  หากต้องการผูกเอกสารกับแฟ้ม ต้องมีคอลัมน์ folder_id ใน documents (เราค่อยทำขั้นถัดไป)
                </div>
              </div>
            `);

            const btnOpenFolder = document.getElementById("btnOpenFolder");
            if (btnOpenFolder) btnOpenFolder.onclick = () => applyRoute(`#folders?parent_id=${id}`);

            const btnCreateChild = document.getElementById("btnCreateChild");
            if (btnCreateChild) btnCreateChild.onclick = () => openModal({ parents: rootFolders, currentParentId: String(id) });
          });
        });

        // open / child buttons
        $$("[data-open]").forEach((b) => {
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-open");
            applyRoute(`#folders?parent_id=${id}`);
          });
        });
        $$("[data-child]").forEach((b) => {
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-child");
            openModal({ parents: rootFolders, currentParentId: String(id) });
          });
        });
      };

      // -------------------------
      // Add minimal CSS helpers once
      // -------------------------
      const ensureStyles = () => {
        if (document.getElementById("__foldersPageStyle")) return;
        const s = document.createElement("style");
        s.id = "__foldersPageStyle";
        s.textContent = `
          .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#fff;border:1px solid rgba(236,72,153,.22);color:#831843;font-weight:900}
          .pill.ghost{background:transparent}
          .card{background:#fff;border:1px solid rgba(236,72,153,.18);border-radius:18px;box-shadow:0 10px 25px rgba(0,0,0,.06)}
          .card-head{padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.06)}
          .folder-list{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
          .folder-row{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 12px;border-radius:14px;border:1px solid rgba(236,72,153,.35);background:#fff;cursor:pointer}
          .folder-row:hover{box-shadow:0 10px 25px rgba(236,72,153,.12)}
          .folder-left{display:flex;align-items:center;gap:10px}
          .folder-ico{font-size:18px}
          .folder-name{font-weight:900;color:#831843}
          .folder-sub{font-size:12px;opacity:.8}
          .folder-actions{display:flex;gap:8px;align-items:center}
          .btn{border:1px solid rgba(0,0,0,.12);background:#fff;color:#111827;padding:8px 12px;border-radius:12px;cursor:pointer;font-weight:800}
          .btn.sm{padding:6px 10px;border-radius:12px}
          .btn.primary{background:#ec4899;border-color:#ec4899;color:#fff}
          .btn.ghost{background:#fce7f3;border-color:rgba(236,72,153,.25);color:#831843}
          .muted{opacity:.75}
          .empty{padding:22px;background:#fff;border:1px dashed rgba(236,72,153,.35);border-radius:18px}
          .kv{display:grid;grid-template-columns:120px 1fr;gap:8px 12px}
          .kv .k{opacity:.75;font-weight:900;color:#6b7280}
          .kv .v{font-weight:900;color:#111827}
        `;
        document.head.appendChild(s);
      };

      ensureStyles();
      await render();
    },
  };
})();
