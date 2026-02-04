// frontend/assets/js/pages/users.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.users = {
    async load(ctx) {
      const { ENDPOINTS, apiFetch, $, setUpdatedNow } = ctx;

      // -------------------------
      // safe selectors (ใช้ของเดิมใน app.html)
      // -------------------------
      const elLeftTitle = $("leftTitle");
      const elLeftBadge = $("leftBadge");
      const elLeftBody = $("leftBody");

      const elRightTitle = $("rightTitle");
      const elRightHint = $("rightHint");
      const elRightBody = $("rightBody");

      if (!elLeftBody || !elRightBody) {
        throw new Error("ไม่พบโครง layout (leftBody/rightBody) ใน app.html");
      }

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

      const getId = (u) => u?.user_id ?? u?.id ?? "";
      const getUsername = (u) => u?.username ?? u?.name ?? "-";
      const getRole = (u) => u?.role ?? "-";
      const isActive = (u) => {
        if (typeof u?.is_active === "boolean") return u.is_active;
        if (typeof u?.active === "boolean") return u.active;
        if (typeof u?.isActive === "boolean") return u.isActive;
        // default
        return true;
      };

      // -------------------------
      // UI Header
      // -------------------------
      if (elLeftTitle) elLeftTitle.textContent = "ผู้ใช้";
      if (elLeftBadge) elLeftBadge.textContent = "—";

      if (elRightTitle) elRightTitle.textContent = "รายละเอียด";
      if (elRightHint) elRightHint.textContent = "คลิกแถวเพื่อดูรายละเอียด";
      elRightBody.innerHTML = `<div class="muted">คลิกแถวเพื่อดูรายละเอียด</div>`;

      // -------------------------
      // Render shell
      // -------------------------
      elLeftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="font-size:18px; font-weight:900;">รายการผู้ใช้</div>
              <div class="muted" style="margin-top:4px;">จัดการผู้ใช้ (เปิด/ปิดการใช้งาน)</div>
            </div>

            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <input id="usersKeyword" class="modal-input" placeholder="ค้นหา username/role..." style="min-width:260px;" />
              <button id="btnUsersSearch" class="btn btn-primary" type="button" style="border-radius:12px;">ค้นหา</button>
              <button id="btnUsersRefresh" class="btn btn-ghost" type="button" style="border-radius:12px;">รีเฟรช</button>
            </div>
          </div>

          <div class="muted" id="usersMeta" style="margin-top:10px;"></div>

          <div style="margin-top:12px; overflow:auto;">
            <table class="doc-table">
              <thead>
                <tr>
                  <th style="min-width:80px;">ID</th>
                  <th style="min-width:200px;">Username</th>
                  <th style="min-width:120px;">Role</th>
                  <th style="min-width:120px;">Active</th>
                  <th style="min-width:180px;">Action</th>
                </tr>
              </thead>
              <tbody id="usersTbody">
                <tr><td colspan="5" class="muted">กำลังโหลด...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const kwEl = document.getElementById("usersKeyword");
      const btnSearch = document.getElementById("btnUsersSearch");
      const btnRefresh = document.getElementById("btnUsersRefresh");
      const metaEl = document.getElementById("usersMeta");
      const tbody = document.getElementById("usersTbody");

      let ALL = [];

      const renderDetail = (u) => {
        const id = getId(u);
        const uname = getUsername(u);
        const role = getRole(u);
        const active = isActive(u);

        elRightBody.innerHTML = `
          <div style="font-weight:900;font-size:16px;">${esc(uname)}</div>
          <div class="muted" style="margin-top:4px;">ID: ${esc(id)}</div>

          <div style="margin-top:12px; line-height:1.9;">
            <div><b>Role:</b> ${esc(role)}</div>
            <div><b>Active:</b> ${active ? "✅ ใช้งานอยู่" : "⛔ ปิดใช้งาน"}</div>
          </div>

          <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary" id="btnToggleUser" type="button">
              ${active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </div>
        `;

        document.getElementById("btnToggleUser")?.addEventListener("click", async () => {
          // ปล. endpoint toggle อาจต่างกันใน backend ของคุณ
          // เราลอง 2 แบบที่พบบ่อย:
          // 1) PATCH /users/:id { is_active: boolean }
          // 2) POST  /users/:id/toggle
          try {
            const next = !active;

            try {
              await apiFetch(`${ENDPOINTS.users}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { is_active: next },
              });
            } catch {
              await apiFetch(`${ENDPOINTS.users}/${encodeURIComponent(id)}/toggle`, {
                method: "POST",
              });
            }

            await loadUsers(true);
          } catch (err) {
            alert(err?.message || "เปลี่ยนสถานะไม่สำเร็จ");
          }
        });
      };

      const renderRows = (rows) => {
        if (!tbody) return;

        if (elLeftBadge) elLeftBadge.textContent = `${rows.length} รายการ`;
        if (metaEl) {
          const activeCount = rows.filter((u) => isActive(u)).length;
          const inactiveCount = rows.length - activeCount;
          metaEl.textContent = `ทั้งหมด ${rows.length} | Active ${activeCount} | Inactive ${inactiveCount}`;
        }

        tbody.innerHTML = rows.length
          ? rows
              .map((u) => {
                const id = getId(u);
                const active = isActive(u);
                return `
                  <tr data-id="${esc(id)}" style="cursor:pointer;">
                    <td>${esc(id)}</td>
                    <td style="font-weight:800;">${esc(getUsername(u))}</td>
                    <td>${esc(getRole(u))}</td>
                    <td>${active ? "🟢" : "⚪"}</td>
                    <td style="white-space:nowrap;">
                      <button class="btn btn-primary" data-action="detail" data-id="${esc(
                        id
                      )}" type="button" style="padding:6px 10px;border-radius:10px;">ดู</button>
                    </td>
                  </tr>
                `;
              })
              .join("")
          : `<tr><td colspan="5" class="muted">ยังไม่มีผู้ใช้</td></tr>`;

        // row click
        tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
          tr.addEventListener("click", (e) => {
            const btn = e.target?.closest?.("button[data-action]");
            if (btn) return;
            const id = tr.getAttribute("data-id");
            const u = rows.find((x) => String(getId(x)) === String(id)) || {};
            renderDetail(u);
          });
        });

        // button detail
        tbody.querySelectorAll("button[data-action='detail']").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute("data-id");
            const u = rows.find((x) => String(getId(x)) === String(id)) || {};
            renderDetail(u);
          });
        });
      };

      const applyFilter = () => {
        const kw = String(kwEl?.value || "").trim().toLowerCase();
        if (!kw) return ALL;
        return ALL.filter((u) => {
          const a = String(getUsername(u)).toLowerCase();
          const b = String(getRole(u)).toLowerCase();
          return a.includes(kw) || b.includes(kw);
        });
      };

      const loadUsers = async (keepFilter = false) => {
        if (!keepFilter && kwEl) kwEl.value = "";
        tbody.innerHTML = `<tr><td colspan="5" class="muted">กำลังโหลด...</td></tr>`;
        try {
          const data = await apiFetch(ENDPOINTS.users);
          ALL = normalizeItems(data);
          renderRows(applyFilter());
          setUpdatedNow?.();
        } catch (err) {
          tbody.innerHTML = `<tr><td colspan="5" style="color:#b91c1c;font-weight:800;">${esc(
            err?.message || "โหลดผู้ใช้ไม่สำเร็จ"
          )}</td></tr>`;
        }
      };

      btnSearch?.addEventListener("click", () => renderRows(applyFilter()));
      kwEl?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderRows(applyFilter());
      });
      btnRefresh?.addEventListener("click", () => loadUsers(true));

      await loadUsers(false);
    },
  };
})();
