// frontend/assets/js/pages/trash.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  // -------------------------
  // ✅ Modal สวยๆ (ใช้ได้ทั้งมี showDetail หรือไม่มี)
  // -------------------------
  const ensureModalStyles = () => {
    if (document.getElementById("__trashPreviewStyles")) return;
    const st = document.createElement("style");
    st.id = "__trashPreviewStyles";
    st.textContent = `
      .tp-overlay{
        position:fixed; inset:0; background:rgba(0,0,0,.45);
        z-index:99999; display:flex; align-items:center; justify-content:center; padding:18px;
      }
      .tp-modal{
        width:min(980px, 100%); max-height:min(86vh, 920px);
        background:#fff; border-radius:20px; overflow:hidden;
        box-shadow:0 30px 80px rgba(0,0,0,.25);
        display:flex; flex-direction:column;
      }
      .tp-head{
        padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.08);
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        background:linear-gradient(180deg, rgba(249,250,251,1), rgba(255,255,255,1));
      }
      .tp-title{font-weight:900; display:flex; align-items:center; gap:10px;}
      .tp-sub{font-size:12px; opacity:.7; font-weight:700}
      .tp-body{padding:14px 16px; overflow:auto;}
      .tp-grid{display:grid; grid-template-columns: 320px 1fr; gap:14px;}
      @media (max-width: 860px){ .tp-grid{grid-template-columns:1fr;} }
      .tp-card{
        border:1px solid rgba(0,0,0,.08); border-radius:16px;
        padding:12px 12px; background:#fff;
      }
      .tp-kv{display:grid; grid-template-columns:110px 1fr; gap:8px; font-size:13px;}
      .tp-k{opacity:.7; font-weight:800}
      .tp-v{font-weight:800; word-break:break-word}
      .tp-actions{display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;}
      .tp-preview{
        border:1px solid rgba(0,0,0,.08); border-radius:16px;
        overflow:hidden; background:#fafafa;
        min-height:340px;
      }
      .tp-preview iframe{width:100%; height:560px; border:0; background:#fff;}
      .tp-preview img{width:100%; height:auto; display:block; background:#fff;}
      .tp-empty{
        padding:24px; text-align:center; font-weight:900;
      }
      .tp-note{margin-top:8px; font-size:12px; opacity:.75; font-weight:700}
      .tp-close{
        padding:6px 10px; border-radius:12px;
      }
    `;
    document.head.appendChild(st);
  };

  const openPreviewModal = ({ title, subtitle, leftHtml, rightNode }) => {
    ensureModalStyles();

    const old = document.getElementById("__trashPreviewModal");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "__trashPreviewModal";
    overlay.className = "tp-overlay";

    overlay.innerHTML = `
      <div class="tp-modal" role="dialog" aria-modal="true">
        <div class="tp-head">
          <div>
            <div class="tp-title">${title}</div>
            <div class="tp-sub">${subtitle || ""}</div>
          </div>
          <button type="button" class="btn btn-ghost tp-close" data-close="1">ปิด</button>
        </div>
        <div class="tp-body">
          <div class="tp-grid">
            <div class="tp-card">
              ${leftHtml || ""}
            </div>
            <div class="tp-preview" id="__trashPreviewArea"></div>
          </div>
        </div>
      </div>
    `;

    const close = () => {
      overlay.remove();
      // cleanup object URL ถ้ามี
      try {
        const u = overlay.__objectUrl;
        if (u) URL.revokeObjectURL(u);
      } catch (_) {}
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector("[data-close]")?.addEventListener("click", close);

    document.body.appendChild(overlay);

    const area = overlay.querySelector("#__trashPreviewArea");
    if (area && rightNode) area.appendChild(rightNode);

    return {
      setObjectUrl(url) {
        overlay.__objectUrl = url;
      },
      close,
      area,
    };
  };

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
      const fmtSize = (n) => {
        const x = Number(n || 0);
        if (!x) return "-";
        const units = ["B", "KB", "MB", "GB"];
        let v = x;
        let i = 0;
        while (v >= 1024 && i < units.length - 1) {
          v /= 1024;
          i++;
        }
        return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
      };

      const getToken = () => localStorage.getItem("token") || "";

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

        const mapDoc = (d) => ({
          kind: "document",
          id: d.document_id ?? d.id,
          name: d.original_file_name ?? d.name ?? "-",
          deleted_at: d.deleted_at ?? null,
          mime_type: d.mime_type ?? "",
          file_size: d.file_size ?? 0,
          raw: d,
        });

        const mapFolder = (f) => ({
          kind: "folder",
          id: f.folder_id ?? f.id,
          name: f.name ?? "-",
          deleted_at: f.deleted_at ?? null,
          raw: f,
        });

        if (type === "documents") return documents.map(mapDoc);
        if (type === "folders") return folders.map(mapFolder);

        const all = [...documents.map(mapDoc), ...folders.map(mapFolder)];

        all.sort((a, b) => {
          const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
          const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
          return tb - ta;
        });

        return all;
      };

      const previewDocument = async (docRow) => {
        const id = docRow.id;
        const name = docRow.name || `file-${id}`;
        const mime = docRow.mime_type || "application/octet-stream";

        // ✅ ยิง backend เพื่อเอาไฟล์ (ต้องใส่ Authorization header)
        const token = getToken();
        const url = `/api/trash/${encodeURIComponent(id)}/file`;

        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          let msg = "เปิดพรีวิวไม่สำเร็จ";
          try {
            const j = await res.json();
            msg = j?.message || msg;
          } catch (_) {}
          throw new Error(msg);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        // สร้าง node preview ตามชนิด
        let node;

        if (/^application\/pdf$/i.test(mime)) {
          node = document.createElement("iframe");
          node.src = objectUrl;
        } else if (/^image\//i.test(mime)) {
          node = document.createElement("img");
          node.src = objectUrl;
          node.alt = name;
        } else {
          node = document.createElement("div");
          node.className = "tp-empty";
          node.innerHTML = `
            ไฟล์ชนิดนี้พรีวิวในเบราว์เซอร์ไม่ได้<br/>
            <div class="tp-note">ให้กด “ดาวน์โหลด” เพื่อเปิดด้วยโปรแกรมที่รองรับ</div>
          `;
        }

        return { objectUrl, node, blob, name };
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
                <div class="muted" style="margin-top:4px;">ดู/พรีวิวเอกสารได้ และกู้คืนได้</div>
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

            const tr = btn.closest("tr");
            const name = (tr?.querySelector("td")?.textContent || "").trim() || "-";

            if (action === "detail") {
              if (kind === "folder") {
                // ✅ folder: แสดงรายละเอียดอย่างเดียว
                if (typeof showDetail === "function") {
                  showDetail(`
                    <div style="font-weight:900;font-size:16px;">📁 แฟ้ม</div>
                    <div style="margin-top:8px; font-weight:900;">ชื่อแฟ้ม: ${esc(name)}</div>
                    <div class="muted" style="margin-top:4px;">ID: ${esc(id)}</div>
                  `);
                } else {
                  openPreviewModal({
                    title: `📁 แฟ้ม`,
                    subtitle: `ดูรายละเอียด`,
                    leftHtml: `
                      <div class="tp-kv"><div class="tp-k">ชื่อ</div><div class="tp-v">${esc(name)}</div></div>
                      <div class="tp-kv" style="margin-top:8px;"><div class="tp-k">ID</div><div class="tp-v">${esc(id)}</div></div>
                      <div class="tp-note">แฟ้มไม่มีพรีวิวไฟล์</div>
                    `,
                    rightNode: (() => {
                      const d = document.createElement("div");
                      d.className = "tp-empty";
                      d.textContent = "ไม่มีพรีวิวสำหรับแฟ้ม";
                      return d;
                    })(),
                  });
                }
                return;
              }

              // ✅ document: เปิด preview modal
              const row = {
                kind,
                id,
                name,
                // พยายามหา mime/size จาก state แถว
                mime_type: "",
                file_size: 0,
              };

              // หา raw row จากตารางที่ render (เอาจากตัวแปร rows ไม่สะดวกตรงนี้)
              // เลยอ่านจาก badge/text ไม่ได้ ต้องพึ่งข้อมูลจาก list ที่อยู่ใน closure
              // วิธีง่าย: fetchTrash(currentType) อีกรอบเฉพาะตอนกดดู (เร็วพอและชัวร์)
              try {
                const raw = await fetchTrash(currentType);
                const allRows = toUnifiedRows(raw, currentType);
                const found = allRows.find((x) => String(x.id) === String(id) && x.kind === "document");
                if (found) {
                  row.mime_type = found.mime_type || "";
                  row.file_size = found.file_size || 0;
                  row.raw = found.raw;
                }
              } catch (_) {}

              // UI โหลด
              const modal = openPreviewModal({
                title: `📄 เอกสาร`,
                subtitle: `พรีวิว/ดาวน์โหลด`,
                leftHtml: `
                  <div class="tp-kv"><div class="tp-k">ชื่อ</div><div class="tp-v">${esc(name)}</div></div>
                  <div class="tp-kv" style="margin-top:8px;"><div class="tp-k">ID</div><div class="tp-v">${esc(id)}</div></div>
                  <div class="tp-kv" style="margin-top:8px;"><div class="tp-k">ชนิด</div><div class="tp-v">${esc(row.mime_type || "-")}</div></div>
                  <div class="tp-kv" style="margin-top:8px;"><div class="tp-k">ขนาด</div><div class="tp-v">${esc(fmtSize(row.file_size))}</div></div>
                  <div class="tp-actions">
                    <button class="btn btn-primary" type="button" data-dl="1" style="padding:8px 12px;border-radius:12px;">ดาวน์โหลด</button>
                    <button class="btn btn-ghost" type="button" data-open="1" style="padding:8px 12px;border-radius:12px;">เปิดแท็บใหม่</button>
                  </div>
                  <div class="tp-note">PDF/รูป จะพรีวิวได้ทันที • ไฟล์อื่นดาวน์โหลดเพื่อเปิดด้วยโปรแกรม</div>
                `,
                rightNode: (() => {
                  const d = document.createElement("div");
                  d.className = "tp-empty";
                  d.textContent = "กำลังโหลดพรีวิว…";
                  return d;
                })(),
              });

              try {
                const { objectUrl, node, name: fileName } = await previewDocument(row);
                modal.setObjectUrl(objectUrl);

                // วาง preview
                if (modal.area) {
                  modal.area.innerHTML = "";
                  modal.area.appendChild(node);
                }

                // bind download/open
                const overlay = document.getElementById("__trashPreviewModal");
                const btnDl = overlay?.querySelector("[data-dl]");
                const btnOpen = overlay?.querySelector("[data-open]");

                if (btnDl) {
                  btnDl.onclick = () => {
                    const a = document.createElement("a");
                    a.href = objectUrl;
                    a.download = fileName || "download";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  };
                }

                if (btnOpen) {
                  btnOpen.onclick = () => {
                    window.open(objectUrl, "_blank", "noopener,noreferrer");
                  };
                }
              } catch (err) {
                if (modal.area) {
                  modal.area.innerHTML = `<div class="tp-empty">❌ ${esc(err?.message || "เปิดพรีวิวไม่สำเร็จ")}</div>`;
                }
              }

              return;
            }

            if (action === "restore") {
              const label =
                kind === "folder"
                  ? "กู้คืนแฟ้มนี้? (จะกู้คืนแฟ้มย่อยทั้งหมดด้วย)"
                  : "กู้คืนเอกสารนี้?";
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