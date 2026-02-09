// frontend/assets/js/pages/users.page.js
(function () {
  const pages = (window.pages = window.pages || {});

  pages.users = {
    async load(ctx) {
      const { ENDPOINTS, apiFetch, $, setUpdatedNow } = ctx;

      const elLeftTitle = $("leftTitle");
      const elLeftBadge = $("leftBadge");
      const elLeftBody = $("leftBody");

      const elRightTitle = $("rightTitle");
      const elRightHint = $("rightHint");
      const elRightBody = $("rightBody");

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
      const getUsername = (u) => u?.username ?? "-";
      const getRole = (u) => u?.role ?? "-";
      const isActive = (u) => (typeof u?.is_active === "boolean" ? u.is_active : true);

      // ===== Header =====
      if (elLeftTitle) elLeftTitle.textContent = "ผู้ใช้";
      if (elLeftBadge) elLeftBadge.textContent = "—";

      // ตัดรายละเอียดออก -> ฝั่งขวาใช้เป็นแค่คำอธิบายสั้น ๆ
      if (elRightTitle) elRightTitle.textContent = "คำแนะนำ";
      if (elRightHint) elRightHint.textContent = "";
      if (elRightBody) {
        elRightBody.innerHTML = `
          <div style="padding:8px 2px; color: rgba(75,0,48,.65); line-height:1.8;">
            <div style="font-weight:900; font-size:15px;">เพิ่มผู้ใช้</div>
            <div class="muted">กดปุ่ม “+ เพิ่มผู้ใช้” แล้วกรอกแค่รหัสพนักงานและรหัสผ่าน</div>
            <div class="muted">ตารางด้านซ้ายจะแสดงรายการผู้ใช้ทั้งหมด</div>
          </div>
        `;
      }

      // ===== Inject: Toast + Modal (ครั้งเดียว) =====
      const ensureToast = () => {
        if (document.getElementById("usersToast")) return;

        const toast = document.createElement("div");
        toast.id = "usersToast";
        toast.style.cssText = `
          position: fixed;
          top: 18px; right: 18px;
          z-index: 9999;
          display: none;
          max-width: 420px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(120,0,70,.14);
          box-shadow: 0 16px 40px rgba(0,0,0,.12);
          backdrop-filter: blur(8px);
          color: rgba(75,0,48,.92);
          font-weight: 700;
        `;
        document.body.appendChild(toast);
      };

      let toastTimer = null;
      const showToast = (message, kind = "ok") => {
        ensureToast();
        const toast = document.getElementById("usersToast");
        if (!toast) return;

        toast.style.display = "block";
        toast.style.borderColor =
          kind === "ok" ? "rgba(16,185,129,.35)" : "rgba(239,68,68,.35)";
        toast.innerHTML = `
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="font-size:18px; line-height:1;">${kind === "ok" ? "✅" : "⚠️"}</div>
            <div style="flex:1;">
              <div style="font-weight:900;">${esc(message)}</div>
              <div style="margin-top:3px; font-weight:600; color: rgba(75,0,48,.6); font-size:12px;">
                ระบบจะอัปเดตรายการให้อัตโนมัติ
              </div>
            </div>
          </div>
        `;

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          toast.style.display = "none";
        }, 2500);
      };

      const ensureModal = () => {
        if (document.getElementById("usersCreateModal")) return;

        const wrap = document.createElement("div");
        wrap.id = "usersCreateModal";
        wrap.style.cssText = `
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0,0,0,.28);
          backdrop-filter: blur(2px);
        `;

        wrap.innerHTML = `
          <div style="
            width: min(520px, 96vw);
            border-radius: 18px;
            background: rgba(255,255,255,.95);
            border: 1px solid rgba(120,0,70,.14);
            box-shadow: 0 20px 55px rgba(0,0,0,.16);
            overflow: hidden;
          ">
            <div style="padding:14px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div>
                <div style="font-weight:1000; font-size:16px; color: rgba(75,0,48,.95);">+ เพิ่มผู้ใช้</div>
                <div style="margin-top:3px; font-size:12px; color: rgba(75,0,48,.55);">กรอกแค่รหัสพนักงาน และรหัสผ่าน</div>
              </div>
              <button id="btnCloseCreateUser" class="btn btn-ghost" type="button" style="border-radius:12px;">ปิด</button>
            </div>

            <div style="padding: 2px 16px 16px;">
              <div style="display:grid; gap:10px;">
                <div>
                  <div style="font-weight:900; font-size:13px; color: rgba(75,0,48,.75); margin-bottom:6px;">รหัสพนักงาน</div>
                  <input id="cuUsername" class="modal-input" placeholder="เช่น 6500123" style="width:100%;" />
                </div>

                <div>
                  <div style="font-weight:900; font-size:13px; color: rgba(75,0,48,.75); margin-bottom:6px;">รหัสผ่าน</div>
                  <input id="cuPassword" class="modal-input" placeholder="ตั้งรหัสผ่าน" type="password" style="width:100%;" />
                </div>

                <div id="cuMsg" style="min-height:18px; font-size:12px; font-weight:800; color: rgba(239,68,68,.9);"></div>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                  <button id="btnCreateUserDo" class="btn btn-primary" type="button" style="border-radius:12px; padding:10px 14px;">
                    บันทึกผู้ใช้
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;

        // click outside to close
        wrap.addEventListener("click", (e) => {
          if (e.target === wrap) hideCreateModal();
        });

        document.body.appendChild(wrap);
      };

      const showCreateModal = () => {
        ensureModal();
        const modal = document.getElementById("usersCreateModal");
        const u = document.getElementById("cuUsername");
        const p = document.getElementById("cuPassword");
        const msg = document.getElementById("cuMsg");

        if (msg) msg.textContent = "";
        if (u) u.value = "";
        if (p) p.value = "";

        if (modal) modal.style.display = "flex";
        setTimeout(() => u?.focus(), 50);
      };

      const hideCreateModal = () => {
        const modal = document.getElementById("usersCreateModal");
        if (modal) modal.style.display = "none";
      };

      // ===== UI Shell (ไม่มีรายละเอียด/การทำงาน) =====
      elLeftBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="font-size:18px; font-weight:1000; color: rgba(75,0,48,.92);">รายการผู้ใช้</div>
              <div class="muted" style="margin-top:4px;">ดูรายการผู้ใช้ และสถานะการใช้งาน</div>
            </div>

            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <input id="usersKeyword" class="modal-input" placeholder="ค้นหา รหัสพนักงาน/Role..." style="min-width:260px;" />
              <button id="btnUsersSearch" class="btn btn-ghost" type="button" style="border-radius:12px;">ค้นหา</button>
              <button id="btnUsersRefresh" class="btn btn-ghost" type="button" style="border-radius:12px;">รีเฟรช</button>
              <button id="btnOpenCreateUser" class="btn btn-primary" type="button" style="border-radius:12px;">+ เพิ่มผู้ใช้</button>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:flex-end;">
            <div class="muted" id="usersMeta"></div>
          </div>

          <div style="margin-top:12px; overflow:auto; border-radius:14px; border:1px solid rgba(120,0,70,.10); background: rgba(255,255,255,.6);">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background: rgba(255,255,255,.7);">
                  <th style="padding:12px 12px; font-size:12px; color: rgba(75,0,48,.7); text-align:left; min-width:80px;">ID</th>
                  <th style="padding:12px 12px; font-size:12px; color: rgba(75,0,48,.7); text-align:left; min-width:220px;">รหัสพนักงาน</th>
                  <th style="padding:12px 12px; font-size:12px; color: rgba(75,0,48,.7); text-align:left; min-width:120px;">Role</th>
                  <th style="padding:12px 12px; font-size:12px; color: rgba(75,0,48,.7); text-align:left; min-width:130px;">สถานะ</th>
                </tr>
              </thead>
              <tbody id="usersTbody">
                <tr><td colspan="4" class="muted" style="padding:14px 12px;">กำลังโหลด...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const kwEl = document.getElementById("usersKeyword");
      const btnSearch = document.getElementById("btnUsersSearch");
      const btnRefresh = document.getElementById("btnUsersRefresh");
      const btnOpenCreate = document.getElementById("btnOpenCreateUser");
      const metaEl = document.getElementById("usersMeta");
      const tbody = document.getElementById("usersTbody");

      let ALL = [];

      const renderRows = (rows) => {
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
                  <tr>
                    <td style="padding:12px 12px; border-top:1px solid rgba(120,0,70,.08);">${esc(id)}</td>
                    <td style="padding:12px 12px; border-top:1px solid rgba(120,0,70,.08); font-weight:1000; color: rgba(75,0,48,.92);">${esc(
                      getUsername(u)
                    )}</td>
                    <td style="padding:12px 12px; border-top:1px solid rgba(120,0,70,.08);">${esc(getRole(u))}</td>
                    <td style="padding:12px 12px; border-top:1px solid rgba(120,0,70,.08);">
                      <span style="
                        display:inline-flex;
                        align-items:center;
                        gap:8px;
                        padding:6px 10px;
                        border-radius:999px;
                        font-weight:900;
                        font-size:12px;
                        border:1px solid rgba(120,0,70,.10);
                        background: rgba(255,255,255,.65);
                        color: ${active ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)"};
                      ">
                        ${active ? "🟢 ใช้งาน" : "🔴 ปิด"}
                      </span>
                    </td>
                  </tr>
                `;
              })
              .join("")
          : `<tr><td colspan="4" class="muted" style="padding:14px 12px;">ยังไม่มีผู้ใช้</td></tr>`;
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

      const loadUsers = async () => {
        tbody.innerHTML = `<tr><td colspan="4" class="muted" style="padding:14px 12px;">กำลังโหลด...</td></tr>`;
        try {
          const data = await apiFetch(ENDPOINTS.users);
          ALL = normalizeItems(data);
          renderRows(applyFilter());
          setUpdatedNow?.();
        } catch (err) {
          tbody.innerHTML = `<tr><td colspan="4" style="padding:14px 12px; color:#b91c1c; font-weight:1000;">${esc(
            err?.message || "โหลดผู้ใช้ไม่สำเร็จ"
          )}</td></tr>`;
        }
      };

      // ===== Modal handlers =====
      btnOpenCreate?.addEventListener("click", () => showCreateModal());

      const wireModalEvents = () => {
        ensureModal();

        document.getElementById("btnCloseCreateUser")?.addEventListener("click", hideCreateModal);

        const btnDo = document.getElementById("btnCreateUserDo");
        const uEl = document.getElementById("cuUsername");
        const pEl = document.getElementById("cuPassword");
        const msgEl = document.getElementById("cuMsg");

        const setMsg = (t = "") => {
          if (msgEl) msgEl.textContent = t;
        };

        const doCreate = async () => {
          const username = String(uEl?.value || "").trim();
          const password = String(pEl?.value || "").trim();

          if (!username || !password) {
            setMsg("กรอกรหัสพนักงาน และรหัสผ่านให้ครบ");
            return;
          }

          btnDo.disabled = true;
          setMsg("");

          try {
            await apiFetch(ENDPOINTS.users, { method: "POST", body: { username, password } });

            // ✅ ตามที่สั่ง: เพิ่มแล้วเด้งแจ้งเตือน + เคลียร์ช่อง + ปิดกล่อง
            showToast("เพิ่มผู้ใช้เรียบร้อย", "ok");

            if (uEl) uEl.value = "";
            if (pEl) pEl.value = "";

            hideCreateModal();
            await loadUsers();
          } catch (err) {
            setMsg(err?.message || "เพิ่มผู้ใช้ไม่สำเร็จ");
            showToast(err?.message || "เพิ่มผู้ใช้ไม่สำเร็จ", "err");
          } finally {
            btnDo.disabled = false;
            setUpdatedNow?.();
          }
        };

        btnDo?.addEventListener("click", doCreate);
        pEl?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") doCreate();
        });
      };

      wireModalEvents();

      btnSearch?.addEventListener("click", () => renderRows(applyFilter()));
      kwEl?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderRows(applyFilter());
      });
      btnRefresh?.addEventListener("click", loadUsers);

      await loadUsers();
    },
  };
})();