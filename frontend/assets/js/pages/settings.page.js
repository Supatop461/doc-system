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
        ? {
            bg: "rgba(34,197,94,.14)",
            bd: "rgba(34,197,94,.22)",
            fg: "rgba(22,101,52,.95)",
            icon: "✅",
          }
        : type === "error"
        ? {
            bg: "rgba(239,68,68,.12)",
            bd: "rgba(239,68,68,.22)",
            fg: "rgba(153,27,27,.95)",
            icon: "⚠️",
          }
        : {
            bg: "rgba(232,62,140,.12)",
            bd: "rgba(232,62,140,.22)",
            fg: "rgba(75,0,48,.95)",
            icon: "ℹ️",
          };

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
          ${message ? `<div style="margin-top:4px; color:rgba(75,0,48,.72); font-weight:700;">${esc(message)}</div>` : ""}
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

    /* modal */
    .st-modal-overlay{
      position:fixed;inset:0;z-index:9999;
      background:rgba(15,23,42,.42);
      backdrop-filter: blur(6px);
      display:flex;align-items:center;justify-content:center;
      padding:18px;
    }
    .st-modal{
      width:min(720px, 100%);
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
    .st-modal-body{padding:16px;}
    .st-field{margin-top:12px;}
    .st-label{display:block;font-weight:950;font-size:12px;color:rgba(75,0,48,.7);margin-bottom:6px;}
    .st-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
    .st-footnote{margin-top:10px;color:rgba(75,0,48,.55);font-size:12px;}
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
        <span style="width:8px;height:8px;border-radius:50%;background:${on ? "rgba(34,197,94,.95)" : "rgba(239,68,68,.95)"}"></span>
        ${on ? "ใช้งาน" : "ปิด"}
      </span>
    `;
  }

  // =========================
  // Modal helper
  // =========================
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
      onMount?.({ close, overlay });
    } catch {}
  }

  function setBusy(btn, busy, textWhileBusy) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset._oldText = btn.textContent;
      btn.textContent = textWhileBusy || "กำลังทำงาน...";
    } else {
      const t = btn.dataset._oldText;
      if (t) btn.textContent = t;
      delete btn.dataset._oldText;
    }
  }

  // =========================
  // Page
  // =========================
  window.pages.settings = {
    async load({ $, setUpdatedNow }) {
      ensureCss();

      const leftBody = $("leftBody");
      const leftBadge = $("leftBadge");

      if (leftBadge) leftBadge.textContent = "ตั้งค่า";
      if (!leftBody) return;

      if (!window.api?.settings?.documentTypes || !window.api?.settings?.itJobTypes) {
        throw new Error("API settings ยังไม่ถูกผูก (window.api.settings.*) — เช็ก api.js");
      }

      // ---- state (ไม่รีโหลดทั้งหน้า) ----
      const state = {
        docTypes: [],
        jobTypes: [],
      };

      const loadAll = async () => {
        const [docTypesRes, jobTypesRes] = await Promise.all([
          window.api.settings.documentTypes.list({ include_inactive: true }),
          window.api.settings.itJobTypes.list({ include_inactive: true }),
        ]);
        state.docTypes = docTypesRes?.data || [];
        state.jobTypes = jobTypesRes?.data || [];
      };

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
                  <button class="st-btn" data-kind="${isDoc ? "doc" : "job"}" data-id="${esc(
              idVal
            )}" type="button">⚙️ จัดการ</button>
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
                ${
                  rows ||
                  `<tr><td colspan="4" class="st-muted" style="padding:14px;">ยังไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `;
      };

      // re-render เฉพาะ content (ไม่ applyRoute)
      const render = () => {
        leftBody.innerHTML = `
          <div class="st-card" style="padding:14px;margin-bottom:12px;">
            <div class="st-title">ชนิดเอกสาร (Document Types)</div>
           

            <form id="formAddDoc" class="st-row" style="margin-top:12px;">
              <input id="inpAddDoc" class="st-input" placeholder="เช่น ใบแจ้งซ่อม / รายงาน / คู่มือ..." />
              <button id="btnAddDoc" type="submit" class="st-btn st-btn-primary">＋ เพิ่ม</button>
            </form>

            <div id="tblDocWrap" style="margin-top:12px;">
              ${renderTable("doc", state.docTypes)}
            </div>
          </div>

          <div class="st-card" style="padding:14px;">
            <div class="st-title">ประเภทงาน IT (IT Job Types)</div>
           

            <form id="formAddJob" class="st-row" style="margin-top:12px;">
              <input id="inpAddJob" class="st-input" placeholder="เช่น Network / System / Support..." />
              <button id="btnAddJob" type="submit" class="st-btn st-btn-primary">＋ เพิ่ม</button>
            </form>

            <div id="tblJobWrap" style="margin-top:12px;">
              ${renderTable("job", state.jobTypes)}
            </div>
          </div>
        `;

        bindHandlers(); // bind ใหม่ทุกครั้งหลัง render
      };

      const rerenderTablesOnly = () => {
        const docWrap = leftBody.querySelector("#tblDocWrap");
        const jobWrap = leftBody.querySelector("#tblJobWrap");
        if (docWrap) docWrap.innerHTML = renderTable("doc", state.docTypes);
        if (jobWrap) jobWrap.innerHTML = renderTable("job", state.jobTypes);
        // ปุ่มจัดการอยู่ในตาราง ต้อง bind ใหม่
        bindManageButtons();
      };

      const findItemByKind = (kind, id) => {
        const isDoc = kind === "doc";
        const items = isDoc ? state.docTypes : state.jobTypes;
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";
        return items.find((x) => String(x?.[idKey]) === String(id));
      };

      const replaceItemByKind = (kind, newItem) => {
        const isDoc = kind === "doc";
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";
        const items = isDoc ? state.docTypes : state.jobTypes;
        const idx = items.findIndex((x) => String(x?.[idKey]) === String(newItem?.[idKey]));
        if (idx >= 0) items[idx] = newItem;
      };

      const removeItemByKind = (kind, id) => {
        const isDoc = kind === "doc";
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";
        if (isDoc) state.docTypes = state.docTypes.filter((x) => String(x?.[idKey]) !== String(id));
        else state.jobTypes = state.jobTypes.filter((x) => String(x?.[idKey]) !== String(id));
      };

      const bindManageButtons = () => {
        leftBody.querySelectorAll("button[data-kind][data-id]").forEach((b) => {
          b.addEventListener("click", () => {
            const kind = b.getAttribute("data-kind");
            const id = b.getAttribute("data-id");

            const item = findItemByKind(kind, id);
            if (!item) return toast({ type: "error", title: "ไม่พบข้อมูล", message: "รายการนี้อาจถูกลบไปแล้ว" });

            openManageModal(kind, item);
          });
        });
      };

      const openManageModal = (kind, item) => {
        const isDoc = kind === "doc";
        const idKey = isDoc ? "document_type_id" : "it_job_type_id";
        const apiObj = isDoc ? window.api.settings.documentTypes : window.api.settings.itJobTypes;

        const idVal = item?.[idKey];
        const activeVal = !!item?.is_active;

        if (!idVal) {
          return toast({ type: "error", title: "ทำรายการไม่ได้", message: "ไม่พบ ID ของรายการ" });
        }

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
              * ลบ = soft delete (ซ่อนรายการ) ไม่ทำให้ระบบพัง
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
                const res = await apiObj.update(idVal, { name });
                const updated = res?.data || { ...item, name };

                replaceItemByKind(kind, updated);
                rerenderTablesOnly();

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
                const res = await apiObj.update(idVal, { is_active: !activeVal });
                const updated = res?.data || { ...item, is_active: !activeVal };

                replaceItemByKind(kind, updated);
                rerenderTablesOnly();

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
                if (!confirm("ยืนยันลบรายการนี้? (soft delete)")) return;

                setBusy(btn, true, "กำลังลบ...");
                await apiObj.remove(idVal);

                // ✅ ลบแล้วหายจากตารางทันที
                removeItemByKind(kind, idVal);
                rerenderTablesOnly();

                toast({ type: "success", title: "ลบแล้ว", message: "รายการถูกนำออกจากตาราง" });
                close();
              } catch (e) {
                toast({ type: "error", title: "ลบไม่สำเร็จ", message: e?.message || String(e) });
              } finally {
                setBusy(btn, false);
              }
            });

            setTimeout(() => $id("stName")?.focus(), 0);
          },
        });
      };

      const bindHandlers = () => {
        // Add doc type
        leftBody.querySelector("#formAddDoc")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = leftBody.querySelector("#btnAddDoc");
          const inp = leftBody.querySelector("#inpAddDoc");

          try {
            const name = (inp?.value || "").trim();
            if (!name) return toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: "กรุณากรอกชื่อชนิดเอกสาร" });

            setBusy(btn, true, "กำลังเพิ่ม...");
            const res = await window.api.settings.documentTypes.create({ name, is_active: true });
            const created = res?.data;

            // ✅ เพิ่มแล้วลงตารางทันที
            if (created) state.docTypes.push(created);
            else state.docTypes.push({ document_type_id: Date.now(), name, is_active: true, updated_at: new Date().toISOString() });

            rerenderTablesOnly();

            // ✅ เคลียร์ input + focus
            if (inp) {
              inp.value = "";
              inp.focus();
            }

            toast({ type: "success", title: "เพิ่มแล้ว", message: `ชนิดเอกสาร “${name}”` });
          } catch (e2) {
            toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: e2?.message || String(e2) });
          } finally {
            setBusy(btn, false);
          }
        });

        // Add job type
        leftBody.querySelector("#formAddJob")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = leftBody.querySelector("#btnAddJob");
          const inp = leftBody.querySelector("#inpAddJob");

          try {
            const name = (inp?.value || "").trim();
            if (!name) return toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: "กรุณากรอกชื่อประเภทงาน IT" });

            setBusy(btn, true, "กำลังเพิ่ม...");
            const res = await window.api.settings.itJobTypes.create({ name, is_active: true });
            const created = res?.data;

            // ✅ เพิ่มแล้วลงตารางทันที
            if (created) state.jobTypes.push(created);
            else state.jobTypes.push({ it_job_type_id: Date.now(), name, is_active: true, updated_at: new Date().toISOString() });

            rerenderTablesOnly();

            // ✅ เคลียร์ input + focus
            if (inp) {
              inp.value = "";
              inp.focus();
            }

            toast({ type: "success", title: "เพิ่มแล้ว", message: `ประเภทงาน IT “${name}”` });
          } catch (e2) {
            toast({ type: "error", title: "เพิ่มไม่สำเร็จ", message: e2?.message || String(e2) });
          } finally {
            setBusy(btn, false);
          }
        });

        bindManageButtons();
      };

      // init
      await loadAll();
      render();
      setUpdatedNow?.();
    },
  };
})();