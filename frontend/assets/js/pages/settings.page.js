// frontend/assets/js/pages/settings.page.js
(function () {
  if (!window.pages) window.pages = {};

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtTime = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString("th-TH");
    } catch {
      return String(d);
    }
  };

  // =========================
  // Toast
  // =========================
  function ensureToastHost() {
    if (document.getElementById("stToastHost")) return;
    const host = document.createElement("div");
    host.id = "stToastHost";
    host.style.cssText = `
      position:fixed; top:14px; right:14px; z-index:10050;
      display:flex; flex-direction:column; gap:10px;
      width:min(360px, calc(100vw - 28px));
      pointer-events:none;
    `;
    document.body.appendChild(host);
  }

  function toast({ title = "สำเร็จ", message = "", type = "success", ms = 2200 } = {}) {
    ensureToastHost();
    const host = document.getElementById("stToastHost");
    if (!host) return;

    const tone =
      type === "success"
        ? { bg: "rgba(34,197,94,.14)", bd: "rgba(34,197,94,.22)", fg: "rgba(22,101,52,.95)", icon: "✅" }
        : type === "error"
        ? { bg: "rgba(239,68,68,.12)", bd: "rgba(239,68,68,.22)", fg: "rgba(153,27,27,.95)", icon: "⚠️" }
        : { bg: "rgba(232,62,140,.12)", bd: "rgba(232,62,140,.22)", fg: "rgba(75,0,48,.95)", icon: "ℹ️" };

    const el = document.createElement("div");
    el.style.cssText = `
      pointer-events:auto;
      border-radius:16px;
      padding:12px 12px;
      border:1px solid ${tone.bd};
      background:${tone.bg};
      color:${tone.fg};
      box-shadow:0 18px 48px rgba(15,23,42,.18);
      backdrop-filter: blur(6px);
      transform: translateY(-6px);
      opacity:0;
      transition: .18s transform, .18s opacity;
    `;
    el.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div style="width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;
                    border:1px solid ${tone.bd}; background:rgba(255,255,255,.6);">
          <span>${tone.icon}</span>
        </div>
        <div style="flex:1;">
          <div style="font-weight:1000; line-height:1.1;">${esc(title)}</div>
          ${
            message
              ? `<div style="margin-top:4px; color:rgba(75,0,48,.72); font-weight:700;">${esc(message)}</div>`
              : ""
          }
        </div>
        <button type="button" aria-label="Close" style="
          border:1px solid ${tone.bd}; background:#fff; color:${tone.fg};
          width:34px;height:34px;border-radius:12px; cursor:pointer;
          box-shadow:0 10px 22px rgba(120,0,70,.06);
        ">✕</button>
      </div>
    `;
    const closeBtn = el.querySelector("button");
    const remove = () => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(() => el.remove(), 180);
    };
    closeBtn?.addEventListener("click", remove);

    host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0px)";
    });

    setTimeout(remove, Math.max(800, ms));
  }

  // =========================
  // CSS
  // =========================
  const cssText = `
    .st-card{background:#fff;border:1px solid rgba(120,0,70,.10);border-radius:18px;box-shadow:0 16px 40px rgba(120,0,70,.08);}
    .st-title{font-weight:950;font-size:16px;color:rgba(75,0,48,.95);}
    .st-sub{color:rgba(75,0,48,.55);margin-top:3px;}
    .st-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
    .st-input{
      width:100%;min-width:220px;
      padding:12px 12px;border-radius:14px;
      border:1px solid rgba(120,0,70,.14);
      background:rgba(255,255,255,.92);
      outline:none;
      box-shadow:0 8px 20px rgba(120,0,70,.05);
    }
    .st-input:focus{border-color:rgba(232,62,140,.45);box-shadow:0 10px 26px rgba(232,62,140,.12);}
    .st-btn{
      display:inline-flex;align-items:center;gap:8px;
      padding:10px 12px;border-radius:14px;
      font-weight:950;font-size:13px;
      border:1px solid rgba(120,0,70,.14);
      background:#fff;
      color:rgba(75,0,48,.95);
      cursor:pointer;
      transition:.15s transform, .15s box-shadow, .15s background;
      box-shadow:0 10px 22px rgba(120,0,70,.06);
      user-select:none;
    }
    .st-btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(120,0,70,.10);}
    .st-btn:active{transform:translateY(0px);box-shadow:0 8px 18px rgba(120,0,70,.08);}
    .st-btn-primary{background:#e83e8c;color:#fff;border-color:rgba(232,62,140,.25);}
    .st-btn-primary:hover{background:#ef4a97;}
    .st-btn-danger{background:rgba(239,68,68,.10);color:#991b1b;border-color:rgba(239,68,68,.20);}
    .st-btn[disabled]{opacity:.55;cursor:not-allowed;transform:none !important;box-shadow:0 8px 18px rgba(120,0,70,.05) !important;}
    .st-table-wrap{overflow:auto;border:1px solid rgba(120,0,70,.10);border-radius:16px;background:#fff;}
    .st-table{width:100%;border-collapse:collapse;min-width:680px;}
    .st-table th,.st-table td{padding:12px 12px;border-bottom:1px solid rgba(120,0,70,.08);text-align:left;}
    .st-table thead th{font-size:12px;font-weight:950;color:rgba(75,0,48,.7);background:rgba(120,0,70,.03);}
    .st-muted{color:rgba(75,0,48,.55);}

    .st-pill{
      display:inline-flex;align-items:center;gap:8px;
      padding:8px 10px;border-radius:999px;
      font-weight:950;font-size:12px;
      border:1px solid rgba(120,0,70,.12);
      background:rgba(255,255,255,.7);
      box-shadow:0 10px 22px rgba(120,0,70,.06);
    }

    /* modal */
    .st-modal-overlay{
      position:fixed;inset:0;z-index:9999;
      background:rgba(15,23,42,.42);
      backdrop-filter: blur(6px);
      display:flex;align-items:center;justify-content:center;
      padding:18px;
    }
    .st-modal{
      width:min(820px, 100%);
      border-radius:22px;
      background:rgba(255,255,255,.98);
      border:1px solid rgba(255,255,255,.55);
      box-shadow:0 30px 80px rgba(15,23,42,.25);
      overflow:hidden;
    }
    .st-modal-head{
      display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
      padding:16px 16px 12px;
      background:linear-gradient(180deg, rgba(232,62,140,.12), rgba(255,255,255,.0));
      border-bottom:1px solid rgba(120,0,70,.10);
      position: sticky;
      top: 0;
      z-index: 2;
      backdrop-filter: blur(6px);
    }
    .st-modal-title{font-weight:1000;font-size:16px;color:rgba(75,0,48,.95);}
    .st-modal-sub{margin-top:3px;color:rgba(75,0,48,.55);font-size:12px;}
    .st-x{
      width:40px;height:40px;border-radius:14px;
      border:1px solid rgba(120,0,70,.14);
      background:#fff;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 10px 22px rgba(120,0,70,.06);
      font-weight:1000;
    }
    .st-modal-body{
      padding:16px;
      max-height:min(72vh, 680px);
      overflow:auto;
    }
    .st-field{margin-top:12px;}
    .st-label{display:block;font-weight:950;font-size:12px;color:rgba(75,0,48,.7);margin-bottom:6px;}
    .st-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
    .st-footnote{margin-top:10px;color:rgba(75,0,48,.55);font-size:12px;}

    /* ==== Trash list (premium) ==== */
    .st-trash-grid{
      display:grid;
      grid-template-columns: 1fr;
      gap:12px;
    }
    @media (min-width: 900px){
      .st-trash-grid{ grid-template-columns: 1fr 1fr; }
    }
    .st-trash-card{
      border:1px solid rgba(120,0,70,.12);
      background:rgba(255,255,255,.92);
      border-radius:18px;
      box-shadow:0 14px 34px rgba(120,0,70,.08);
      overflow:hidden;
    }
    .st-trash-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:12px 14px;
      background:linear-gradient(180deg, rgba(232,62,140,.12), rgba(255,255,255,0));
      border-bottom:1px solid rgba(120,0,70,.10);
    }
    .st-trash-title{
      font-weight:1000;
      color:rgba(75,0,48,.95);
      display:flex;
      align-items:center;
      gap:8px;
    }
    .st-trash-count{
      font-weight:950;
      font-size:12px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(120,0,70,.12);
      background:rgba(255,255,255,.65);
      color:rgba(75,0,48,.75);
    }
    .st-trash-list{
      padding:10px 12px 12px;
    }
    .st-trash-item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:10px 10px;
      border:1px solid rgba(120,0,70,.08);
      border-radius:16px;
      background:#fff;
      box-shadow:0 10px 22px rgba(120,0,70,.05);
      margin-top:10px;
    }
    .st-trash-item:first-child{ margin-top:0; }
    .st-trash-name{
      font-weight:1000;
      color:rgba(75,0,48,.95);
      line-height:1.15;
      word-break: break-word;
    }
    .st-trash-meta{
      margin-top:4px;
      font-size:12px;
      font-weight:800;
      color:rgba(75,0,48,.55);
    }
    .st-restore{
      border-radius:14px;
      padding:10px 12px;
      font-weight:1000;
      border:1px solid rgba(232,62,140,.25);
      background:linear-gradient(180deg, #ef4a97, #e83e8c);
      color:#fff;
      cursor:pointer;
      box-shadow:0 14px 30px rgba(232,62,140,.18);
      transition:.15s transform, .15s box-shadow;
      white-space:nowrap;
    }
    .st-restore:hover{ transform:translateY(-1px); box-shadow:0 18px 38px rgba(232,62,140,.22); }
    .st-restore:active{ transform:translateY(0px); box-shadow:0 10px 22px rgba(232,62,140,.16); }
    .st-trash-empty{
      padding:14px 12px;
      border:1px dashed rgba(120,0,70,.18);
      border-radius:16px;
      color:rgba(75,0,48,.55);
      font-weight:900;
      background:rgba(120,0,70,.03);
    }
  `;

  function ensureCss() {
    if (document.getElementById("stSettingsCss")) return;
    const style = document.createElement("style");
    style.id = "stSettingsCss";
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function pill(active) {
    const on = !!active;
    return `
      <span style="
        display:inline-flex;align-items:center;gap:6px;
        padding:6px 10px;border-radius:999px;
        font-size:12px;font-weight:950;
        border:1px solid rgba(120,0,70,.12);
        background:${on ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.10)"};
        color:${on ? "rgba(22,101,52,.95)" : "rgba(153,27,27,.95)"};
      ">
        <span style="width:8px;height:8px;border-radius:50%;background:${
          on ? "rgba(34,197,94,.95)" : "rgba(239,68,68,.95)"
        }"></span>
        ${on ? "ใช้งาน" : "ปิด"}
      </span>
    `;
  }

  function openModal({ title, subtitle, bodyHtml, onMount }) {
    document.getElementById("stModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "stModalOverlay";
    overlay.className = "st-modal-overlay";
    overlay.innerHTML = `
      <div class="st-modal" role="dialog" aria-modal="true">
        <div class="st-modal-head">
          <div>
            <div class="st-modal-title">${esc(title || "จัดการ")}</div>
            <div class="st-modal-sub">${esc(subtitle || "")}</div>
          </div>
          <button class="st-x" id="stModalClose" type="button" aria-label="Close">✕</button>
        </div>
        <div class="st-modal-body">
          ${bodyHtml || ""}
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener(
      "keydown",
      function escClose(ev) {
        if (ev.key === "Escape") {
          close();
          document.removeEventListener("keydown", escClose);
        }
      },
      { once: true }
    );

    document.body.appendChild(overlay);
    document.getElementById("stModalClose")?.addEventListener("click", close);

    try {
      onMount?.({ close });
    } catch (e) {
      console.error(e);
    }
  }

  function setBusy(btn, busy, text) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset._old = btn.textContent;
      btn.textContent = text || "กำลังทำงาน...";
    } else if (btn.dataset._old) {
      btn.textContent = btn.dataset._old;
      delete btn.dataset._old;
    }
  }

  // =========================
  // Page
  // =========================
  window.pages.settings = {
    async load({ ENDPOINTS, apiFetch, $, setUpdatedNow }) {
      ensureCss();

      const leftBody = $("leftBody");
      const leftBadge = $("leftBadge");
      if (leftBadge) leftBadge.textContent = "ตั้งค่า";
      if (!leftBody) return;

      // ✅ ไม่พึ่ง window.api.settings (กัน query param ไม่ถูกส่ง)
      const api = {
        doc: {
          list: (qs) => apiFetch(`${ENDPOINTS.settings}/document-types${qs || ""}`),
          create: (body) => apiFetch(`${ENDPOINTS.settings}/document-types`, { method: "POST", body }),
          update: (id, body) =>
            apiFetch(`${ENDPOINTS.settings}/document-types/${id}`, { method: "PUT", body }),
          remove: (id) => apiFetch(`${ENDPOINTS.settings}/document-types/${id}`, { method: "DELETE" }),
        },
        job: {
          list: (qs) => apiFetch(`${ENDPOINTS.settings}/it-job-types${qs || ""}`),
          create: (body) => apiFetch(`${ENDPOINTS.settings}/it-job-types`, { method: "POST", body }),
          update: (id, body) => apiFetch(`${ENDPOINTS.settings}/it-job-types/${id}`, { method: "PUT", body }),
          remove: (id) => apiFetch(`${ENDPOINTS.settings}/it-job-types/${id}`, { method: "DELETE" }),
        },
      };

      const state = { docAll: [], jobAll: [] };

      const loadAll = async () => {
        // ✅ ดึง “ทั้งหมด” รวมที่ถูกลบ
        const qs = `?include_inactive=1&include_deleted=1`;
        const [docRes, jobRes] = await Promise.all([api.doc.list(qs), api.job.list(qs)]);
        state.docAll = docRes?.data || [];
        state.jobAll = jobRes?.data || [];
        setUpdatedNow?.();
      };

      const activeOnly = (arr) => (arr || []).filter((x) => !x?.deleted_at);
      const deletedOnly = (arr) => (arr || []).filter((x) => !!x?.deleted_at);

      const renderTable = (kind, items) => {
        const isDoc = kind === "doc";
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";

        const rows = items
          .slice()
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "th"))
          .map((x) => {
            const idVal = x?.[idKey];
            return `
              <tr>
                <td style="font-weight:950;">${esc(x?.name)}</td>
                <td>${pill(!!x?.is_active)}</td>
                <td class="st-muted">${esc(fmtTime(x?.updated_at || x?.created_at))}</td>
                <td style="text-align:right;">
                  <button class="st-btn" data-kind="${kind}" data-id="${esc(idVal)}" type="button">⚙️ จัดการ</button>
                </td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="st-table-wrap">
            <table class="st-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th style="width:140px;">สถานะ</th>
                  <th style="width:220px;">อัปเดต</th>
                  <th style="width:160px; text-align:right;">การทำงาน</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="4" class="st-muted" style="padding:14px;">ยังไม่มีข้อมูล</td></tr>`}
              </tbody>
            </table>
          </div>
        `;
      };

      // ✅ Trash modal: premium cards
      const openTrashModal = () => {
        const docTrash = deletedOnly(state.docAll);
        const jobTrash = deletedOnly(state.jobAll);

        const renderTrashCard = (kind, title, items) => {
          const isDoc = kind === "doc";
          const idKey = isDoc ? "document_type_id" : "it_job_type_id";

          const rows = items
            .slice()
            .sort((a, b) => new Date(b?.deleted_at || 0) - new Date(a?.deleted_at || 0))
            .map((x) => {
              const idVal = x?.[idKey];
              return `
                <div class="st-trash-item">
                  <div style="min-width:0;">
                    <div class="st-trash-name">${esc(x?.name)}</div>
                    <div class="st-trash-meta">ลบเมื่อ: ${esc(fmtTime(x?.deleted_at))}</div>
                  </div>
                  <button class="st-restore" data-restore-kind="${kind}" data-restore-id="${esc(idVal)}" type="button">
                    ♻️ กู้คืน
                  </button>
                </div>
              `;
            })
            .join("");

          return `
            <div class="st-trash-card">
              <div class="st-trash-head">
                <div class="st-trash-title">🗑️ ${esc(title)}</div>
                <div class="st-trash-count">${items.length} รายการ</div>
              </div>
              <div class="st-trash-list">
                ${rows || `<div class="st-trash-empty">ไม่มีรายการที่ถูกลบ</div>`}
              </div>
            </div>
          `;
        };

        openModal({
          title: "รายการที่ถูกลบ",
          subtitle: "กด ♻️ เพื่อกู้คืนกลับมาใช้งาน",
          bodyHtml: `
            <div class="st-trash-grid">
              ${renderTrashCard("doc", "ชนิดเอกสารที่ถูกลบ", docTrash)}
              ${renderTrashCard("job", "งาน IT ที่ถูกลบ", jobTrash)}
            </div>
            <div class="st-footnote">
              * การกู้คืน = ตั้งค่า deleted_at = NULL และ is_active = true
            </div>
          `,
          onMount: ({ close }) => {
            document.querySelectorAll("[data-restore-kind][data-restore-id]").forEach((btn) => {
              btn.addEventListener("click", async () => {
                const kind = btn.getAttribute("data-restore-kind");
                const id = btn.getAttribute("data-restore-id");
                try {
                  setBusy(btn, true, "กำลังกู้คืน...");
                  if (kind === "doc") await api.doc.update(id, { deleted_at: null, is_active: true });
                  else await api.job.update(id, { deleted_at: null, is_active: true });

                  await loadAll();
                  render();
                  toast({ type: "success", title: "กู้คืนแล้ว", message: "รายการถูกกู้คืนกลับมาใช้งาน" });
                  close();
                } catch (e) {
                  toast({ type: "error", title: "กู้คืนไม่สำเร็จ", message: e?.message || String(e) });
                } finally {
                  setBusy(btn, false);
                }
              });
            });
          },
        });
      };

      const findByKind = (kind, id) => {
        const isDoc = kind === "doc";
        const arr = isDoc ? state.docAll : state.jobAll;
        const key = isDoc ? "document_type_id" : "it_job_type_id";
        return arr.find((x) => String(x?.[key]) === String(id));
      };

      const bindManageButtons = () => {
        leftBody.querySelectorAll("button[data-kind][data-id]").forEach((b) => {
          b.addEventListener("click", () => {
            const kind = b.getAttribute("data-kind");
            const id = b.getAttribute("data-id");
            const item = findByKind(kind, id);
            if (!item) return toast({ type: "error", title: "ไม่พบข้อมูล", message: "รายการนี้อาจถูกลบไปแล้ว" });
            openManageModal(kind, item);
          });
        });
      };

      const openManageModal = (kind, item) => {
        const isDoc = kind === "doc";
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";
        const idVal = item?.[idKey];
        const activeVal = !!item?.is_active;

        openModal({
          title: isDoc ? "จัดการชนิดเอกสาร" : "จัดการประเภทงาน IT",
          subtitle: `ID: ${idVal} • อัปเดต: ${fmtTime(item?.updated_at || item?.created_at)}`,
          bodyHtml: `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div class="st-muted" style="font-weight:900;">
                ${esc(isDoc ? "Document Type" : "IT Job Type")}
              </div>
              ${pill(activeVal)}
            </div>

            <div class="st-field">
              <label class="st-label">ชื่อ</label>
              <input id="stName" class="st-input" value="${esc(item?.name)}" placeholder="กรอกชื่อ..." />
            </div>

            <div class="st-actions">
              <button id="stSave" class="st-btn st-btn-primary" type="button">💾 บันทึก</button>
              <button id="stToggle" class="st-btn" type="button">
                ${activeVal ? "⛔ ปิดการใช้งาน" : "✅ เปิดการใช้งาน"}
              </button>
              <button id="stDelete" class="st-btn st-btn-danger" type="button">🗑️ ลบ</button>
            </div>

            <div class="st-footnote">
              * ลบ = ส่งไปถังขยะ (deleted_at) และสามารถกู้คืนได้
            </div>
          `,
          onMount: ({ close }) => {
            const $id = (x) => document.getElementById(x);

            $id("stSave")?.addEventListener("click", async () => {
              const btn = $id("stSave");
              try {
                const name = ($id("stName")?.value || "").trim();
                if (!name) return toast({ type: "error", title: "กรอกชื่อก่อน", message: "กรุณากรอกชื่อให้ครบ" });

                setBusy(btn, true, "กำลังบันทึก...");
                if (isDoc) await api.doc.update(idVal, { name });
                else await api.job.update(idVal, { name });

                await loadAll();
                render();

                toast({ type: "success", title: "บันทึกแล้ว", message: `แก้ไขชื่อเป็น “${name}”` });
                close();
              } catch (e) {
                toast({ type: "error", title: "บันทึกไม่สำเร็จ", message: e?.message || String(e) });
              } finally {
                setBusy(btn, false);
              }
            });

            $id("stToggle")?.addEventListener("click", async () => {
              const btn = $id("stToggle");
              try {
                setBusy(btn, true, "กำลังอัปเดต...");
                if (isDoc) await api.doc.update(idVal, { is_active: !activeVal });
                else await api.job.update(idVal, { is_active: !activeVal });

                await loadAll();
                render();

                toast({
                  type: "success",
                  title: "อัปเดตสถานะแล้ว",
                  message: !activeVal ? "เปิดการใช้งานเรียบร้อย" : "ปิดการใช้งานเรียบร้อย",
                });
                close();
              } catch (e) {
                toast({ type: "error", title: "อัปเดตไม่สำเร็จ", message: e?.message || String(e) });
              } finally {
                setBusy(btn, false);
              }
            });

            $id("stDelete")?.addEventListener("click", async () => {
              const btn = $id("stDelete");
              try {
                if (!confirm("ยืนยันลบ? (จะไปอยู่ถังขยะและกู้คืนได้)")) return;

                setBusy(btn, true, "กำลังลบ...");
                if (isDoc) await api.doc.remove(idVal);
                else await api.job.remove(idVal);

                await loadAll();
                render();

                toast({ type: "success", title: "ลบแล้ว", message: "รายการถูกย้ายไปถังขยะ" });
                close();
              } catch (e) {
                toast({ type: "error", title: "ลบไม่สำเร็จ", message: e?.message || String(e) });
              } finally {
                setBusy(btn, false);
              }
            });
          },
        });
      };

      const render = () => {
        const docActive = activeOnly(state.docAll);
        const jobActive = activeOnly(state.jobAll);
        const docTrash = deletedOnly(state.docAll);
        const jobTrash = deletedOnly(state.jobAll);

        leftBody.innerHTML = `
          <div class="st-card" style="padding:14px;margin-bottom:12px;">
            <div class="st-title">ชนิดเอกสาร (Document Types)</div>

            <div class="st-row" style="margin-top:10px;">
              <span class="st-pill">ใช้งาน: ${docActive.length} • ถูกลบ: ${docTrash.length}</span>
              <button id="btnDocTrash" class="st-btn" type="button">🗑️ ดูที่ถูกลบ</button>
            </div>

            <form id="formAddDoc" class="st-row" style="margin-top:12px;">
              <input id="inpAddDoc" class="st-input" placeholder="เช่น ใบแจ้งซ่อม / รายงาน / คู่มือ..." />
              <button id="btnAddDoc" type="submit" class="st-btn st-btn-primary">＋ เพิ่ม</button>
            </form>

            <div id="tblDocWrap" style="margin-top:12px;">
              ${renderTable("doc", docActive)}
            </div>
          </div>

          <div class="st-card" style="padding:14px;">
            <div class="st-title">ประเภทงาน IT (IT Job Types)</div>

            <div class="st-row" style="margin-top:10px;">
              <span class="st-pill">ใช้งาน: ${jobActive.length} • ถูกลบ: ${jobTrash.length}</span>
              <button id="btnJobTrash" class="st-btn" type="button">🗑️ ดูที่ถูกลบ</button>
            </div>

            <form id="formAddJob" class="st-row" style="margin-top:12px;">
              <input id="inpAddJob" class="st-input" placeholder="เช่น Network / System / Support..." />
              <button id="btnAddJob" type="submit" class="st-btn st-btn-primary">＋ เพิ่ม</button>
            </form>

            <div id="tblJobWrap" style="margin-top:12px;">
              ${renderTable("job", jobActive)}
            </div>
          </div>
        `;

        leftBody.querySelector("#btnDocTrash")?.addEventListener("click", openTrashModal);
        leftBody.querySelector("#btnJobTrash")?.addEventListener("click", openTrashModal);

        leftBody.querySelector("#formAddDoc")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const inp = leftBody.querySelector("#inpAddDoc");
          const btn = leftBody.querySelector("#btnAddDoc");
          const name = (inp?.value || "").trim();
          if (!name) return toast({ type: "error", title: "กรอกชื่อก่อน", message: "กรุณากรอกชื่อชนิดเอกสาร" });

          try {
            setBusy(btn, true, "กำลังเพิ่ม...");
            await api.doc.create({ name, is_active: true });
            inp.value = "";
            await loadAll();
            render();
            toast({ type: "success", title: "เพิ่มแล้ว", message: name });
          } catch (err) {
            toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: err?.message || String(err) });
          } finally {
            setBusy(btn, false);
          }
        });

        leftBody.querySelector("#formAddJob")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const inp = leftBody.querySelector("#inpAddJob");
          const btn = leftBody.querySelector("#btnAddJob");
          const name = (inp?.value || "").trim();
          if (!name) return toast({ type: "error", title: "กรอกชื่อก่อน", message: "กรุณากรอกประเภทงาน IT" });

          try {
            setBusy(btn, true, "กำลังเพิ่ม...");
            await api.job.create({ name, is_active: true });
            inp.value = "";
            await loadAll();
            render();
            toast({ type: "success", title: "เพิ่มแล้ว", message: name });
          } catch (err) {
            toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: err?.message || String(err) });
          } finally {
            setBusy(btn, false);
          }
        });

        bindManageButtons();
      };

      await loadAll();
      render();
    },
  };
})();