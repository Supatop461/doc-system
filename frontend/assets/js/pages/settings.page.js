// frontend/assets/js/pages/settings.page.js
(function () {
  if (!window.pages) window.pages = {};

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.pages.settings = {
    async load({ $, showDetail, setUpdatedNow }) {
      // left panel
      const leftBody = $("leftBody");
      const leftBadge = $("leftBadge");
      const tableBody = $("tableBody");

      if (leftBadge) leftBadge.textContent = "ตั้งค่า";

      // โหลดข้อมูล
      const [docTypesRes, jobTypesRes] = await Promise.all([
        window.api.settings.documentTypes.list({ include_inactive: true }),
        window.api.settings.itJobTypes.list({ include_inactive: true }),
      ]);

      const docTypes = docTypesRes?.data || [];
      const jobTypes = jobTypesRes?.data || [];

      if (leftBody) {
        leftBody.innerHTML = `
          <div class="card" style="padding:12px; margin-bottom:10px;">
            <div style="font-weight:800; margin-bottom:6px;">เพิ่มชนิดเอกสาร</div>
            <form id="formAddDocType" style="display:flex; gap:8px;">
              <input id="inpDocType" class="input" placeholder="ชื่อชนิดเอกสาร..." style="flex:1;" />
              <button class="btn-primary" type="submit">เพิ่ม</button>
            </form>
          </div>

          <div class="card" style="padding:12px;">
            <div style="font-weight:800; margin-bottom:6px;">เพิ่มประเภทงาน IT</div>
            <form id="formAddJobType" style="display:flex; gap:8px;">
              <input id="inpJobType" class="input" placeholder="ชื่อประเภทงาน IT..." style="flex:1;" />
              <button class="btn-primary" type="submit">เพิ่ม</button>
            </form>
          </div>
        `;

        // bind create doc type
        leftBody.querySelector("#formAddDocType").addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = leftBody.querySelector("#inpDocType").value.trim();
          if (!name) return alert("กรุณากรอกชื่อชนิดเอกสาร");
          await window.api.settings.documentTypes.create({ name, is_active: true });
          alert("เพิ่มชนิดเอกสารแล้ว");
          window.app?.applyRoute?.(); // reload page
        });

        // bind create job type
        leftBody.querySelector("#formAddJobType").addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = leftBody.querySelector("#inpJobType").value.trim();
          if (!name) return alert("กรุณากรอกชื่อประเภทงาน IT");
          await window.api.settings.itJobTypes.create({ name, is_active: true });
          alert("เพิ่มประเภทงาน IT แล้ว");
          window.app?.applyRoute?.();
        });
      }

      // table (กลาง) แสดงรวม
      const rows = [];

      for (const d of docTypes) {
        rows.push(`
          <tr>
            <td>${esc(d.name)}</td>
            <td>Document Type</td>
            <td>${esc(String(d.is_active))}</td>
            <td><button class="btn" data-kind="doc" data-id="${esc(d.document_type_id)}">รายละเอียด</button></td>
          </tr>
        `);
      }

      for (const j of jobTypes) {
        rows.push(`
          <tr>
            <td>${esc(j.name)}</td>
            <td>IT Job Type</td>
            <td>${esc(String(j.is_active))}</td>
            <td><button class="btn" data-kind="job" data-id="${esc(j.it_job_type_id)}">รายละเอียด</button></td>
          </tr>
        `);
      }

      if (tableBody) {
        tableBody.innerHTML = rows.length
          ? rows.join("")
          : `<tr><td colspan="4" class="muted">ยังไม่มีข้อมูล</td></tr>`;

        tableBody.querySelectorAll("button[data-kind]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const kind = btn.getAttribute("data-kind");
            const id = btn.getAttribute("data-id");
            const item =
              kind === "doc"
                ? docTypes.find((x) => String(x.document_type_id) === String(id))
                : jobTypes.find((x) => String(x.it_job_type_id) === String(id));

            showDetail(
              "รายละเอียด",
              `<div class="card" style="padding:12px;">
                <div><b>ID:</b> ${esc(id)}</div>
                <div><b>ชื่อ:</b> ${esc(item?.name)}</div>
                <div><b>Active:</b> ${esc(String(item?.is_active))}</div>
              </div>`
            );
          });
        });
      }

      setUpdatedNow?.();
    },
  };
})();
