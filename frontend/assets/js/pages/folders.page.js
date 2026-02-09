// frontend/assets/js/pages/folders.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.folders = {
    async load(ctx) {
      const { ENDPOINTS, $, $$, apiFetch, setUpdatedNow } = ctx;

      // =========================
      // Utils
      // =========================
      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const parseItems = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        if (Array.isArray(raw?.documents)) return raw.documents;
        return [];
      };

      const fmt = (n) => new Intl.NumberFormat("th-TH").format(Number(n || 0));

      const getUser = () => {
        try {
          return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
          return {};
        }
      };

      const isAdminUser = () => {
        const u = getUser();
        const role = String(u.role || u.user_role || "").toLowerCase();
        return (
          role === "admin" ||
          u.is_admin === true ||
          u.isAdmin === true ||
          u.is_admin === 1
        );
      };

      const humanizeError = (e) => {
        const msg = String(e?.message || "").trim();
        if (!msg) return "เกิดข้อผิดพลาด";
        if (msg.includes("DELETE_FOLDER_NOT_EMPTY")) {
          return "ลบไม่ได้: แฟ้มนี้ยังมีแฟ้มย่อยหรือเอกสารอยู่\nกรุณาลบ/ย้ายออกให้หมดก่อน";
        }
        if (msg.includes("ต้องส่ง Authorization")) {
          return "สิทธิ์ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่";
        }
        if (msg.includes("ต้องเข้าสู่ระบบใหม่")) {
          return "กรุณาเข้าสู่ระบบใหม่";
        }
        if (msg.includes("PARENT_DOCUMENT_TYPE_MISSING")) {
          return "สร้างไม่ได้: แฟ้มแม่ยังไม่มี “ประเภทเอกสาร” กรุณาตั้งค่าแฟ้มแม่ก่อน";
        }
        if (msg.includes("PARENT_IT_JOB_TYPE_MISSING")) {
          return "สร้างไม่ได้: แฟ้มแม่ยังไม่มี “งาน IT” กรุณาตั้งค่าแฟ้มแม่ก่อน";
        }
        return msg;
      };

      const showToast = (msg, type = "info") => {
        let box = document.getElementById("__toastBox");
        if (!box) {
          box = document.createElement("div");
          box.id = "__toastBox";
          box.className = "toast-wrap";
          document.body.appendChild(box);
        }
        const node = document.createElement("div");
        node.className = `toast ${type}`;
        node.textContent = msg;
        box.appendChild(node);
        setTimeout(() => node.classList.add("show"), 10);
        setTimeout(() => {
          node.classList.remove("show");
          setTimeout(() => node.remove(), 250);
        }, 2200);
      };

      // =========================
      // Blob (preview/download) with Bearer
      // =========================
      const getToken = () => window.api?.getToken?.() || localStorage.getItem("token") || "";

      async function fetchBlobWithAuth(url) {
        const headers = new Headers();
        const token = getToken();
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

      function pickName(doc) {
        return (
          String(doc?.title || "").trim() ||
          String(doc?.original_file_name || "").trim() ||
          String(doc?.file_name || "").trim() ||
          `document-${doc?.document_id || doc?.id || ""}`
        );
      }

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

      // =========================
      // Simple preview modal (on top of folder detail)
      // =========================
      let docOverlay = null;
      let currentObjectUrl = null;

      const clearObjectUrl = () => {
        if (currentObjectUrl) {
          try {
            URL.revokeObjectURL(currentObjectUrl);
          } catch {}
          currentObjectUrl = null;
        }
      };

      const ensureDocPreviewModal = () => {
        if (docOverlay) return docOverlay;

        docOverlay = document.createElement("div");
        docOverlay.id = "fdPreviewOverlay";
        docOverlay.className = "fd-overlay fd-overlay--preview";
        docOverlay.style.zIndex = "10050";

        docOverlay.innerHTML = `
          <div class="fd-card" style="max-width:1000px; width:min(1000px, 96vw);" role="dialog" aria-modal="true">
            <div class="fd-head">
              <div>
                <div class="fd-title" id="pvTitle">พรีวิวเอกสาร</div>
                <div class="fd-sub" id="pvSub">—</div>
              </div>
              <button type="button" class="fd-x" id="pvClose">✕</button>
            </div>
            <div class="fd-body" style="padding:14px;">
              <div id="pvBody" class="muted">กำลังโหลด…</div>
            </div>
            <div class="fd-foot">
              <div class="fd-actions">
                <button class="fd-btn" type="button" id="pvBack">ปิด</button>
              </div>
              <div class="fd-actions">
                <button class="fd-btn fd-btn-primary" type="button" id="pvDownload">ดาวน์โหลด</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(docOverlay);

        const close = () => {
          docOverlay.style.display = "none";
          clearObjectUrl();
        };

        docOverlay.addEventListener("click", (e) => {
          if (e.target === docOverlay) close();
        });
        docOverlay.querySelector("#pvClose").onclick = close;
        docOverlay.querySelector("#pvBack").onclick = close;

        return docOverlay;
      };

      async function previewDoc(doc) {
        const id = String(doc?.document_id || doc?.id || "");
        if (!id) return;

        const name = pickName(doc);
        const overlay = ensureDocPreviewModal();
        overlay.style.display = "flex";

        overlay.querySelector("#pvTitle").textContent = name;
        overlay.querySelector("#pvSub").textContent = `ID: ${id}`;

        const body = overlay.querySelector("#pvBody");
        body.innerHTML = `<div class="muted">กำลังโหลดพรีวิว…</div>`;

        const previewUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/preview`;
        const downloadUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;

        overlay.querySelector("#pvDownload").onclick = async () => {
          try {
            const blob = await fetchBlobWithAuth(downloadUrl);
            clearObjectUrl();
            currentObjectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = currentObjectUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast("เริ่มดาวน์โหลดแล้ว", "ok");
          } catch (e) {
            showToast(`ดาวน์โหลดไม่ได้: ${humanizeError(e)}`, "error");
          }
        };

        try {
          const blob = await fetchBlobWithAuth(previewUrl);
          clearObjectUrl();
          currentObjectUrl = URL.createObjectURL(blob);

          const m = guessMime(name, blob.type || doc?.mime_type);
          if (m.includes("pdf") || blob.type === "application/pdf") {
            body.innerHTML = `<iframe class="doc-modal__iframe" style="width:100%;height:70vh;border:0;border-radius:14px;" src="${esc(
              currentObjectUrl
            )}" title="${esc(name)}" loading="lazy"></iframe>`;
          } else if ((m || "").startsWith("image/")) {
            body.innerHTML = `<img class="doc-modal__img" style="max-width:100%;border-radius:14px;" src="${esc(
              currentObjectUrl
            )}" alt="${esc(name)}" />`;
          } else {
            body.innerHTML = `<div class="muted">ไฟล์นี้ไม่รองรับพรีวิว กรุณากด “ดาวน์โหลด”</div>`;
            clearObjectUrl();
          }
        } catch (e) {
          body.innerHTML = `<div class="folder-error" style="display:block;">พรีวิวไม่ได้: ${esc(
            humanizeError(e)
          )}</div>`;
        }
      }

      async function downloadDoc(doc) {
        const id = String(doc?.document_id || doc?.id || "");
        if (!id) return;
        const name = pickName(doc);
        const downloadUrl = `${ENDPOINTS.documents}/${encodeURIComponent(id)}/download`;
        const blob = await fetchBlobWithAuth(downloadUrl);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast("เริ่มดาวน์โหลดแล้ว", "ok");
      }

      // =========================
      // Data helpers
      // =========================
      const getId = (f) => f.folder_id ?? f.id ?? f.folderId;
      const getPid = (f) => f.parent_id ?? f.parentId ?? null;

      // persist expanded
      const EXP_KEY = "__folders_expanded_v4";
      const expanded = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem(EXP_KEY) || "[]");
        if (Array.isArray(saved)) saved.forEach((x) => expanded.add(String(x)));
      } catch {}

      const persistExpanded = () => {
        try {
          localStorage.setItem(EXP_KEY, JSON.stringify([...expanded]));
        } catch {}
      };

    // =========================
// Lookups (document types / IT jobs)
// =========================
let docTypes = [];
let itJobs = [];

const ensureLookups = async () => {
  if (docTypes.length && itJobs.length) return;

  try {
    // ✅ ใช้ path จริงจาก backend
    const [a, b] = await Promise.all([
      apiFetch("/api/settings/document-types"),
      apiFetch("/api/settings/it-job-types"),
    ]);

    docTypes = parseItems(a);
    itJobs = parseItems(b);

    if (!Array.isArray(docTypes)) docTypes = [];
    if (!Array.isArray(itJobs)) itJobs = [];
  } catch (e) {
    console.error("ensureLookups error:", e);
    docTypes = [];
    itJobs = [];
  }
};

      const fillSelect = (sel, items, idKey, labelKey, value) => {
        if (!sel) return;
        sel.innerHTML =
          `<option value="">— ไม่ระบุ —</option>` +
          items
            .map((x) => {
              const id = x?.[idKey];
              const name = x?.[labelKey];
              const s = String(id) === String(value) ? "selected" : "";
              return `<option value="${esc(id)}" ${s}>${esc(name)}</option>`;
            })
            .join("");
      };

      // =========================
      // Build tree
      // =========================
      const buildTree = (folders) => {
        const map = new Map();
        const roots = [];

        folders.forEach((f) => {
          const id = String(getId(f));
          map.set(id, { ...f, __id: id, children: [] });
        });

        map.forEach((node) => {
          const pid = getPid(node);
          if (pid == null || pid === "" || !map.has(String(pid))) {
            roots.push(node);
          } else {
            map.get(String(pid)).children.push(node);
          }
        });

        const sortRec = (arr) => {
          arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
          arr.forEach((x) => sortRec(x.children));
        };
        sortRec(roots);

        return roots;
      };

      const countNodes = (nodes) => {
        let n = 0;
        const walk = (arr) => {
          arr.forEach((x) => {
            n += 1;
            if (x.children?.length) walk(x.children);
          });
        };
        walk(nodes);
        return n;
      };

      const maxDepth = (nodes) => {
        const walk = (arr, d) =>
          arr.reduce((m, x) => Math.max(m, x.children?.length ? walk(x.children, d + 1) : d), d);
        return nodes.length ? walk(nodes, 1) : 0;
      };

      const filterTree = (nodes, q) => {
        q = String(q || "").trim().toLowerCase();
        if (!q) return nodes;
        const keep = (node) => {
          const name = String(node.name || "").toLowerCase();
          const hit = name.includes(q);
          const kids = (node.children || []).map(keep).filter(Boolean);
          if (hit || kids.length) return { ...node, children: kids };
          return null;
        };
        return nodes.map(keep).filter(Boolean);
      };

      // =========================
      // Modals
      // =========================
      const ensureDetailModal = () => {
        let overlay = document.getElementById("fdDetailOverlay");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "fdDetailOverlay";
        overlay.className = "fd-overlay fd-overlay--detail";
        overlay.style.zIndex = "9950";

        overlay.innerHTML = `
          <div class="fd-card" role="dialog" aria-modal="true" aria-label="รายละเอียดแฟ้ม">
            <div class="fd-head">
              <div>
                <div class="fd-title">รายละเอียดแฟ้ม</div>
                <div class="fd-sub" id="fdSub">—</div>
              </div>
              <button type="button" class="fd-x" id="fdClose">✕</button>
            </div>

            <div class="fd-body">
              <div class="folder-error" id="fdErr"></div>

              <div class="fd-form">
                <div class="fd-grid">
                  <div class="fd-row">
                    <label class="fd-label">ชื่อแฟ้ม</label>
                    <input class="fd-input" id="fdName" />
                  </div>
                  <div class="fd-row">
                    <label class="fd-label">Prefix</label>
                    <input class="fd-input" id="fdPrefix" placeholder="เช่น IT, SYS, ER" />
                  </div>
                </div>

                <div class="fd-grid">
                  <div class="fd-row">
                    <label class="fd-label">ประเภทเอกสาร</label>
                    <select class="fd-input" id="fdDocType"></select>
                  </div>
                  <div class="fd-row">
                    <label class="fd-label">งาน IT</label>
                    <select class="fd-input" id="fdItJob"></select>
                  </div>
                </div>

                <div class="fd-row">
                  <label class="fd-label">คำอธิบาย</label>
                  <textarea class="fd-input fd-textarea" id="fdDesc" rows="3"></textarea>
                </div>

                <div class="fd-docs" id="fdDocsBox" style="display:none">
                  <div class="fd-docs-head">
                    <div>
                      <div class="fd-docs-title">เอกสารในแฟ้มนี้</div>
                      <div class="fd-docs-sub" id="fdDocsSub">—</div>
                    </div>
                  </div>
                  <div class="fd-docs-tablewrap">
                    <table class="fd-docs-table">
                      <thead>
                        <tr>
                          <th>ชื่อเอกสาร</th>
                          <th>อัปเดต</th>
                          <th style="text-align:right">การทำงาน</th>
                        </tr>
                      </thead>
                      <tbody id="fdDocsTbody"></tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div class="fd-foot">
              <div class="fd-actions">
                <button class="fd-btn fd-btn-ghost" id="fdLoadDocs" type="button">ดูเอกสารในแฟ้ม</button>
                <button class="fd-btn fd-danger" id="fdDelete" type="button">ลบแฟ้ม</button>
              </div>
              <div class="fd-actions">
                <button class="fd-btn" id="fdCancel" type="button">ปิด</button>
                <button class="fd-btn fd-btn-primary" id="fdSave" type="button">บันทึก</button>
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
        overlay.querySelector("#fdCancel").addEventListener("click", close);

        return overlay;
      };

      const ensureCreateModal = () => {
        let overlay = document.querySelector(".folder-modal-overlay");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.className = "folder-modal-overlay";
        overlay.innerHTML = `
          <div class="folder-modal" role="dialog" aria-modal="true" aria-label="สร้างแฟ้ม">
            <div class="folder-modal-header">
              <div style="font-weight:950;color:#831843">สร้างแฟ้ม</div>
              <button class="btn sm ghost" type="button" id="cfClose">ปิด</button>
            </div>
            <div class="folder-modal-body">
              <div class="folder-error" id="cfErr"></div>

              <label>ชื่อแฟ้ม</label>
              <input id="cfName" placeholder="เช่น งานระบบ, คู่มือ, แบบฟอร์ม" />

              <label>ภายใต้แฟ้ม</label>
              <select id="cfParent">
                <option value="">— แฟ้มหลัก —</option>
              </select>

              <label>ประเภทเอกสาร</label>
              <select id="cfDocType">
                <option value="">— ไม่ระบุ —</option>
              </select>

              <label>งาน IT</label>
              <select id="cfItJob">
                <option value="">— ไม่ระบุ —</option>
              </select>

              <label>Prefix</label>
              <input id="cfPrefix" placeholder="เช่น IT, SYS, ER" />

              <label>คำอธิบาย</label>
              <input id="cfDesc" placeholder="ใส่/ไม่ใส่ก็ได้" />
            </div>
            <div class="folder-modal-footer">
              <button class="btn ghost" id="cfCancel" type="button">ยกเลิก</button>
              <button class="btn primary" id="cfCreate" type="button">สร้าง</button>
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

      // =========================
      // Actions
      // =========================
      const openCreate = async ({ currentParentId = "" } = {}) => {
        await ensureLookups();

        const overlay = ensureCreateModal();
        overlay.style.display = "flex";
        overlay.querySelector("#cfErr").style.display = "none";
        overlay.querySelector("#cfErr").textContent = "";

        const rawAll = await apiFetch(`${ENDPOINTS.folders}?all=1`);
        const allFolders = parseItems(rawAll);

        const parentSel = overlay.querySelector("#cfParent");
        parentSel.innerHTML =
          `<option value="">— แฟ้มหลัก —</option>` +
          allFolders
            .map((x) => {
              const id = getId(x);
              const name = x.name || "-";
              const s = String(id) === String(currentParentId) ? "selected" : "";
              return `<option value="${esc(id)}" ${s}>${esc(name)} (ID:${esc(id)})</option>`;
            })
            .join("");

        fillSelect(overlay.querySelector("#cfDocType"), docTypes, "document_type_id", "name", "");
        fillSelect(overlay.querySelector("#cfItJob"), itJobs, "it_job_type_id", "name", "");

        overlay.querySelector("#cfName").value = "";
        overlay.querySelector("#cfPrefix").value = "";
        overlay.querySelector("#cfDesc").value = "";

        const close = () => (overlay.style.display = "none");

        overlay.querySelector("#cfCreate").onclick = async () => {
          try {
            const payload = {
              name: overlay.querySelector("#cfName").value.trim(),
              parent_id: parentSel.value ? Number(parentSel.value) : null,
              document_type_id: overlay.querySelector("#cfDocType").value
                ? Number(overlay.querySelector("#cfDocType").value)
                : null,
              it_job_type_id: overlay.querySelector("#cfItJob").value
                ? Number(overlay.querySelector("#cfItJob").value)
                : null,
              doc_prefix: overlay.querySelector("#cfPrefix").value.trim() || null,
              description: overlay.querySelector("#cfDesc").value.trim() || null,
            };

            if (!payload.name) {
              overlay.querySelector("#cfErr").style.display = "block";
              overlay.querySelector("#cfErr").textContent = "กรุณาใส่ชื่อแฟ้ม";
              return;
            }

            await apiFetch(ENDPOINTS.folders, {
              method: "POST",
              body: payload,
            });

            showToast("สร้างแฟ้มสำเร็จ", "ok");
            close();
            await render();
          } catch (e) {
            overlay.querySelector("#cfErr").style.display = "block";
            overlay.querySelector("#cfErr").textContent = humanizeError(e);
          }
        };

        overlay.querySelector("#cfCancel").onclick = close;
      };

      // =========================
      // UI Render
      // =========================
      let stateQ = "";

      const renderNode = (node, level = 0) => {
        const hasChildren = (node.children || []).length > 0;
        const isOpen = expanded.has(node.__id);
        const indent = 10 + level * 18;
        const childCount = (node.children || []).length;

        // ✅ แสดงประเภท/งาน IT (ข้อมูลจริงจาก DB)
        const dt = node.document_type_name || "";
        const ij = node.it_job_type_name || "";

        return `
          <div class="fx-wrap">
            <div class="fx-node" style="padding-left:${indent}px" data-id="${esc(node.__id)}">
              <button type="button"
                class="fx-toggle"
                data-toggle="${esc(node.__id)}"
                ${hasChildren ? "" : 'disabled="disabled"'}
                aria-label="toggle">
                ${hasChildren ? (isOpen ? "▾" : "▸") : "•"}
              </button>

              <button type="button" class="fx-main" data-open="${esc(node.__id)}" title="ดูรายละเอียด">
                <span class="fx-emoji">📁</span>
                <span class="fx-name">${esc(node.name || "-")}</span>
                <span class="fx-meta">
                  <span class="fx-chip">ID ${esc(node.__id)}</span>
                  ${dt ? `<span class="fx-chip">${esc(dt)}</span>` : ""}
                  ${ij ? `<span class="fx-chip soft">${esc(ij)}</span>` : ""}
                  ${hasChildren ? `<span class="fx-chip soft">${fmt(childCount)} ย่อย</span>` : ""}
                </span>
              </button>

              <div class="fx-actions">
                <button type="button" class="fx-iconbtn" data-child="${esc(node.__id)}" title="เพิ่มแฟ้มย่อย">＋</button>
                <button type="button" class="fx-iconbtn" data-detail="${esc(node.__id)}" title="รายละเอียด">⋯</button>
              </div>
            </div>

            ${
              hasChildren && isOpen
                ? `<div class="fx-children">
                    ${node.children.map((c) => renderNode(c, level + 1)).join("")}
                   </div>`
                : ""
            }
          </div>
        `;
      };

      const renderRightSummary = ({ allFolders, roots }) => {
        $("rightTitle").textContent = "สรุปแฟ้ม";
        $("rightHint").textContent = "";

        const depth = maxDepth(roots);
        const rootCount = roots.length;
        const total = allFolders.length;

        $("rightBody").innerHTML = `
          <div class="fx-side">
            <div class="fx-statgrid">
              <div class="fx-stat">
                <div class="fx-statn">${fmt(total)}</div>
                <div class="fx-statk">แฟ้มทั้งหมด</div>
              </div>
              <div class="fx-stat">
                <div class="fx-statn">${fmt(rootCount)}</div>
                <div class="fx-statk">แฟ้มหลัก</div>
              </div>
              <div class="fx-stat">
                <div class="fx-statn">${fmt(depth)}</div>
                <div class="fx-statk">ความลึกสูงสุด</div>
              </div>
            </div>

            <div class="fx-sidehint">
              * คลิกชื่อแฟ้มเพื่อเปิด “รายละเอียด”<br/>
              * ปุ่ม “＋” = เพิ่มแฟ้มย่อย<br/>
              * “ดูเอกสารในแฟ้ม” สามารถพรีวิว/ดาวน์โหลด/ลบได้ทันที
            </div>
          </div>
        `;
      };

      const render = async () => {
        await ensureLookups();

        const rawAll = await apiFetch(`${ENDPOINTS.folders}?all=1`);
        const allFolders = parseItems(rawAll);
        const roots = buildTree(allFolders);
        const filteredRoots = filterTree(roots, stateQ);

        $("leftTitle").textContent = "แฟ้มเอกสาร";
        $("leftBadge").textContent = `${fmt(allFolders.length)} แฟ้ม`;

        $("leftBody").innerHTML = `
          <div class="fx-card">
            <div class="fx-head">
              <div>
                <div class="fx-title">Folder Explorer</div>
                <div class="fx-sub">ค้นหา • เปิดรายละเอียด • เพิ่มแฟ้มย่อย</div>
              </div>

              <div class="fx-tools">
                <input id="foldersQ" class="fx-search" placeholder="ค้นหาแฟ้ม..." value="${esc(stateQ)}" />
                <button class="fx-mini" type="button" data-action="expandAll">ขยาย</button>
                <button class="fx-mini" type="button" data-action="collapseAll">ย่อ</button>
              </div>
            </div>

            <div class="fx-tree">
              ${
                filteredRoots.length
                  ? filteredRoots.map((r) => renderNode(r)).join("")
                  : `<div class="fx-empty">ไม่พบแฟ้มที่ตรงกับคำค้นหา</div>`
              }
            </div>

            <div class="fx-foot">
              แสดง ${fmt(countNodes(filteredRoots))} รายการจากทั้งหมด ${fmt(allFolders.length)} แฟ้ม
            </div>
          </div>
        `;

        renderRightSummary({ allFolders, roots });

        $$("[data-toggle]").forEach((b) => {
          if (b.dataset.bound === "1") return;
          b.dataset.bound = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = b.getAttribute("data-toggle");
            if (!id) return;
            expanded.has(id) ? expanded.delete(id) : expanded.add(id);
            persistExpanded();
            render();
          });
        });

        const openDetail = async (id) => {
          const folder = allFolders.find((x) => String(getId(x)) === String(id));
          if (!folder) return;

          const m = ensureDetailModal();
          const fid = String(getId(folder));
          const pid = folder.parent_id ?? folder.parentId ?? null;

          const docTypeId = folder.document_type_id ?? folder.documentTypeId ?? null;
          const itJobId = folder.it_job_type_id ?? folder.itJobTypeId ?? null;

          m.querySelector("#fdSub").textContent = `ID: ${fid}${pid == null ? " • แฟ้มหลัก" : ` • Parent: ${pid}`}`;

          m.querySelector("#fdErr").style.display = "none";
          m.querySelector("#fdErr").textContent = "";

          m.querySelector("#fdName").value = folder.name || "";

          fillSelect(m.querySelector("#fdDocType"), docTypes, "document_type_id", "name", docTypeId);
          fillSelect(m.querySelector("#fdItJob"), itJobs, "it_job_type_id", "name", itJobId);

          m.querySelector("#fdPrefix").value = folder.doc_prefix ?? folder.prefix ?? "";
          m.querySelector("#fdDesc").value = folder.description ?? "";

          m.querySelector("#fdDocsBox").style.display = "none";
          m.style.display = "flex";

          // ✅ ซ่อน admin actions สำหรับ user ทั่วไป
          const admin = isAdminUser();
          m.querySelector("#fdDelete").style.display = admin ? "" : "none";
          m.querySelector("#fdSave").style.display = admin ? "" : "none";
          m.querySelector("#fdName").disabled = !admin;
          m.querySelector("#fdDocType").disabled = !admin;
          m.querySelector("#fdItJob").disabled = !admin;
          m.querySelector("#fdPrefix").disabled = !admin;
          m.querySelector("#fdDesc").disabled = !admin;

          // Save (✅ ใช้ PATCH ให้ตรง backend)
          m.querySelector("#fdSave").onclick = async () => {
            try {
              const payload = {
                name: m.querySelector("#fdName").value.trim(),
                document_type_id: m.querySelector("#fdDocType").value
                  ? Number(m.querySelector("#fdDocType").value)
                  : null,
                it_job_type_id: m.querySelector("#fdItJob").value
                  ? Number(m.querySelector("#fdItJob").value)
                  : null,
                doc_prefix: m.querySelector("#fdPrefix").value.trim() || null,
                description: m.querySelector("#fdDesc").value.trim() || null,
              };

              if (!payload.name) {
                m.querySelector("#fdErr").style.display = "block";
                m.querySelector("#fdErr").textContent = "กรุณาใส่ชื่อแฟ้ม";
                return;
              }

              await apiFetch(`${ENDPOINTS.folders}/${fid}`, {
                method: "PATCH",
                body: payload,
              });

              showToast("บันทึกสำเร็จ", "ok");
              m.style.display = "none";
              await render();
            } catch (e) {
              m.querySelector("#fdErr").style.display = "block";
              m.querySelector("#fdErr").textContent = humanizeError(e);
            }
          };

          // Delete folder (admin only)
          m.querySelector("#fdDelete").onclick = async () => {
            if (!confirm("ยืนยันลบแฟ้มนี้? (ต้องไม่มีแฟ้มย่อย/เอกสารในแฟ้ม)")) return;
            try {
              await apiFetch(`${ENDPOINTS.folders}/${fid}`, { method: "DELETE" });
              showToast("ลบแฟ้มสำเร็จ", "ok");
              m.style.display = "none";
              await render();
            } catch (e) {
              m.querySelector("#fdErr").style.display = "block";
              m.querySelector("#fdErr").textContent = humanizeError(e);
            }
          };

          // Load docs in folder
          m.querySelector("#fdLoadDocs").onclick = async () => {
            try {
              const raw = await apiFetch(`${ENDPOINTS.documents}?folder_id=${encodeURIComponent(fid)}&limit=50`);
              const docs = parseItems(raw);

              const box = m.querySelector("#fdDocsBox");
              const tbody = m.querySelector("#fdDocsTbody");
              m.querySelector("#fdDocsSub").textContent = `${fmt(docs.length)} รายการ`;

              if (!docs.length) {
                tbody.innerHTML = `<tr><td colspan="3" class="muted">ยังไม่มีเอกสารในแฟ้มนี้</td></tr>`;
              } else {
                tbody.innerHTML = docs
                  .map((d) => {
                    const name = pickName(d);
                    const updated = d.updated_at || d.updatedAt || d.created_at || d.createdAt || "";
                    const did = d.document_id || d.id;
                    return `
                      <tr>
                        <td><span class="fd-doc-name">${esc(name)}</span></td>
                        <td class="muted">${esc(updated ? new Date(updated).toLocaleString("th-TH") : "-")}</td>
                        <td class="fd-doc-actions">
                          <button class="fd-mini fd-mini-preview" type="button" data-open-doc="${esc(did)}">ดู</button>
                          <button class="fd-mini fd-mini-download" type="button" data-dl-doc="${esc(did)}">ดาวน์โหลด</button>
                          <button class="fd-mini fd-mini-danger" type="button" data-del-doc="${esc(did)}">ลบ</button>
                        </td>
                      </tr>
                    `;
                  })
                  .join("");
              }

              box.style.display = "block";

              tbody.querySelectorAll("[data-open-doc]").forEach((b) => {
                b.onclick = async () => {
                  const did = b.getAttribute("data-open-doc");
                  const d = docs.find((x) => String(x.document_id || x.id) === String(did));
                  if (!d) return;
                  await previewDoc(d);
                };
              });

              tbody.querySelectorAll("[data-dl-doc]").forEach((b) => {
                b.onclick = async () => {
                  try {
                    const did = b.getAttribute("data-dl-doc");
                    const d = docs.find((x) => String(x.document_id || x.id) === String(did));
                    if (!d) return;
                    await downloadDoc(d);
                  } catch (e) {
                    showToast(`ดาวน์โหลดไม่ได้: ${humanizeError(e)}`, "error");
                  }
                };
              });

              tbody.querySelectorAll("[data-del-doc]").forEach((b) => {
                b.onclick = async () => {
                  const did = b.getAttribute("data-del-doc");
                  if (!did) return;
                  if (!confirm("ยืนยันลบเอกสารนี้? (ย้ายไปถังขยะ)")) return;

                  try {
                    await apiFetch(`${ENDPOINTS.documents}/${encodeURIComponent(did)}`, { method: "DELETE" });
                    showToast("ย้ายไปถังขยะแล้ว", "ok");
                    m.querySelector("#fdLoadDocs").click();
                  } catch (e) {
                    showToast(`ลบไม่ได้: ${humanizeError(e)}`, "error");
                  }
                };
              });
            } catch (e) {
              m.querySelector("#fdErr").style.display = "block";
              m.querySelector("#fdErr").textContent = humanizeError(e);
            }
          };
        };

        $$("[data-open]").forEach((b) => {
          if (b.dataset.bound === "1") return;
          b.dataset.bound = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDetail(b.getAttribute("data-open"));
          });
        });

        $$("[data-detail]").forEach((b) => {
          if (b.dataset.bound === "1") return;
          b.dataset.bound = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDetail(b.getAttribute("data-detail"));
          });
        });

        $$("[data-child]").forEach((b) => {
          if (b.dataset.bound === "1") return;
          b.dataset.bound = "1";
          b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCreate({ currentParentId: b.getAttribute("data-child") });
          });
        });

        const qEl = document.getElementById("foldersQ");
        if (qEl && qEl.dataset.bound !== "1") {
          qEl.dataset.bound = "1";
          qEl.addEventListener("input", () => {
            stateQ = qEl.value || "";
            render();
          });
        }

        $$("[data-action]").forEach((b) => {
          if (b.dataset.bound === "1") return;
          b.dataset.bound = "1";
          b.addEventListener("click", () => {
            const act = b.getAttribute("data-action");
            if (act === "expandAll") {
              allFolders.forEach((f) => expanded.add(String(getId(f))));
              persistExpanded();
              render();
            }
            if (act === "collapseAll") {
              expanded.clear();
              persistExpanded();
              render();
            }
          });
        });

        setUpdatedNow?.();
      };

      const btnNew = document.getElementById("btnNew");
      if (btnNew) btnNew.onclick = () => openCreate({ currentParentId: "" });

      $("rightTitle").textContent = "สรุปแฟ้ม";
      $("rightBody").innerHTML = `<div class="muted">กำลังโหลด…</div>`;

      await render();
    },
  };
})();