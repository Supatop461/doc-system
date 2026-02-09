// frontend/assets/js/app.js
(function () {
  // =========================
  // Config
  // =========================
  const API_BASE =
    window.API_BASE ||
    localStorage.getItem("API_BASE") ||
    "http://localhost:3000/api";

  const ENDPOINTS = {
    folders: `${API_BASE}/folders`,
    documents: `${API_BASE}/documents`,
    trash: `${API_BASE}/trash`,
    settings: `${API_BASE}/settings`,
    users: `${API_BASE}/users`,
    auth: `${API_BASE}/auth`,
    // optional
    documentTypes: `${API_BASE}/document-types`,
    itJobTypes: `${API_BASE}/it-job-types`,
  };

  // =========================
  // DOM Utils (รองรับ id + selector)
  // =========================
  const isSelector = (s) => {
    if (s == null) return false;
    const x = String(s);
    return (
      x.startsWith("#") ||
      x.startsWith(".") ||
      x.startsWith("[") ||
      x.includes(" ") ||
      x.includes(">") ||
      x.includes(":")
    );
  };

  const $ = (key, root = document) => {
    if (!key) return null;
    const k = String(key);
    if (isSelector(k)) return root.querySelector(k);

    if (root && typeof root.getElementById === "function") return root.getElementById(k);
    return document.getElementById(k);
  };

  const $$ = (key, root = document) => {
    if (!key) return [];
    const k = String(key);
    if (isSelector(k)) return Array.from(root.querySelectorAll(k));
    const one = $(k, root);
    return one ? [one] : [];
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // =========================
  // API (ใช้จาก api.js)
  // =========================
  const apiFetch = async (url, opts = {}) => {
    if (window.api?.apiFetch) return window.api.apiFetch(url, opts);

    // fallback (กันพังถ้า api.js ไม่โหลด)
    const token = localStorage.getItem("token") || "";
    const headers = new Headers(opts.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let body = opts.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      if (!headers.get("Content-Type")) headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    const res = await fetch(url, { ...opts, headers, body });
    const text = await res.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
    return data;
  };

  const getToken = () =>
    window.api?.getToken?.() || localStorage.getItem("token") || "";

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const redirectToLogin = () => {
    location.href = "./index.html";
  };

  // ✅ แสดง: บนสุด=รหัสพนักงาน, รหัส:=ไอดี, ROLE:=สิทธิ์
  async function loadUserBox() {
    try {
      const token = getToken();
      if (!token) return redirectToLogin();

      const res = await fetch("http://localhost:3000/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        clearSession();
        return redirectToLogin();
      }

      const data = await res.json().catch(() => ({}));
      const me = data?.me || {};

      const id = me?.id ?? me?.user_id ?? me?.userId ?? "-";
      const role = String(me?.role || "-").toUpperCase();

      const empCode =
        me?.employee_code ??
        me?.emp_code ??
        me?.staff_code ??
        me?.employeeCode ??
        me?.username ??
        id;

      if ($("userName")) $("userName").textContent = String(empCode);
      if ($("userCode")) $("userCode").textContent = String(id);
      if ($("userRole")) $("userRole").textContent = role;
    } catch (err) {
      console.error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ:", err);
      clearSession();
      redirectToLogin();
    }
  }

  // =========================
  // Layout refs (อิง app.html)
  // =========================
  const panelRight = () => $("panelRight");
  const panelLeft = () => $("panelLeft");

  const leftTitle = () => $("leftTitle");
  const leftBadge = () => $("leftBadge");
  const leftBody = () => $("leftBody");

  const rightTitle = () => $("rightTitle");
  const rightHint = () => $("rightHint");
  const rightBody = () => $("rightBody");

  const pageTitle = () => $("pageTitle");
  const pageDesc = () => $("pageDesc");

  const lastUpdated = () => $("lastUpdated");

  const assertLayout = () => {
    if (!leftBody() || !rightBody()) {
      throw new Error("ไม่พบโครง layout (leftBody/rightBody) ใน app.html");
    }
  };

  // =========================
  // Right panel visibility
  // =========================
  const setRightPanelVisible = (visible) => {
    const pr = panelRight();
    if (!pr) return;
    pr.style.display = visible ? "" : "none";
  };

  const rightHasContent = () => {
    const t = (rightTitle()?.textContent || "").trim();
    const h = (rightHint()?.textContent || "").trim();

    const rb = rightBody();
    let bodyHas = false;
    if (rb) {
      bodyHas = rb.children.length > 0 || (rb.textContent || "").trim().length > 0;
    }
    return t.length > 0 || h.length > 0 || bodyHas;
  };

  const autoHideRightPanelIfEmpty = () => {
    setRightPanelVisible(rightHasContent());
  };

  // =========================
  // UI helpers
  // =========================
  const setText = (title, desc) => {
    if (pageTitle()) pageTitle().textContent = title ?? "";
    if (pageDesc()) pageDesc().textContent = desc ?? "";
    document.title = title ? `${title} | Doc System` : "Doc System";
  };

  const setUpdatedNow = () => {
    const el = lastUpdated();
    if (el) el.textContent = `อัปเดตล่าสุด: ${new Date().toLocaleString("th-TH")}`;
  };

  // หน้าที่ใช้ panel ขวา เรียก showDetail ได้
  const showDetail = (html) => {
    if (rightBody()) rightBody().innerHTML = html ?? "";
    setRightPanelVisible(true);
  };

  const setLoadingIntoLeft = (title) => {
    if (leftTitle()) leftTitle().textContent = title ?? "กำลังโหลด…";
    if (leftBadge()) leftBadge().textContent = "กำลังโหลด…";
    if (leftBody()) {
      leftBody().innerHTML = `
        <div style="padding:14px;">
          <div class="muted">กำลังโหลดข้อมูล…</div>
        </div>
      `;
    }
  };

  const setErrorIntoLeft = (title, err) => {
    if (leftTitle()) leftTitle().textContent = title ?? "ผิดพลาด";
    if (leftBadge()) leftBadge().textContent = "ผิดพลาด";
    if (leftBody()) {
      leftBody().innerHTML = `
        <div style="padding:14px;">
          <div style="font-weight:950;color:#b91c1c;">${esc(title || "เกิดข้อผิดพลาด")}</div>
          <div style="margin-top:8px;white-space:pre-wrap;color:#b91c1c;">${esc(
            err?.message || String(err || "")
          )}</div>
          <div style="margin-top:12px;">
            <button id="btnRetry" class="btn btn-ghost" type="button">ลองใหม่</button>
          </div>
        </div>
      `;
      $("btnRetry")?.addEventListener("click", renderRoute);
    }
  };

  // =========================
  // Cleanup before route
  // =========================
  const cleanupBeforeRoute = () => {
    // เคลียร์ right panel ทุกครั้ง
    if (rightTitle()) rightTitle().textContent = "";
    if (rightHint()) rightHint().textContent = "";
    if (rightBody()) rightBody().innerHTML = "";

    // เริ่มต้นซ่อน panel ขวาไว้ก่อน
    setRightPanelVisible(false);

    // ป้องกัน event ของ btnNew ค้างจากหน้าก่อน
    const btn = $("btnNew");
    if (btn && btn.parentNode) {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    }

    // ปิด overlay/modals ที่อาจค้าง (best-effort)
    const maybeOverlays = [
      "uploadModalOverlay",
      "docModalOverlay",
      "upOverlay",
      "fdDetailOverlay",
      "fdPreviewOverlay",
    ];
    maybeOverlays.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  };

  const setBtnNewVisible = (visible, label = "+ เพิ่มใหม่") => {
    const btn = $("btnNew");
    if (!btn) return;
    btn.style.display = visible ? "inline-flex" : "none";
    btn.textContent = label;
  };

  // =========================
  // Router
  // =========================
  const normalizeHash = (h) => {
    if (!h) return "#folders";
    let x = String(h).trim();
    if (!x.startsWith("#")) x = `#${x}`;
    const q = x.indexOf("?");
    if (q !== -1) x = x.slice(0, q);
    return x.toLowerCase();
  };

  const ROUTES = {
    folders: {
      title: "แฟ้มเอกสาร",
      desc: "จัดการแฟ้มเอกสารและเอกสารภายในระบบ",
      moduleKey: "folders",
      newBtn: true,
      newLabel: "＋ เพิ่มแฟ้ม",
    },
    all: {
      title: "เอกสารทั้งหมด",
      desc: "รายการเอกสารทั้งหมดในระบบ",
      moduleKey: "documents",
      newBtn: true,
      newLabel: "＋ เพิ่มเอกสาร",
    },
    search: { title: "ค้นหา", desc: "ค้นหาเอกสารในระบบ", moduleKey: "search", newBtn: false },
    trash: { title: "ถังขยะ", desc: "รายการเอกสารที่ถูกลบ (กู้คืนได้)", moduleKey: "trash", newBtn: false },
    settings: { title: "ตั้งค่า", desc: "ตั้งค่าระบบเบื้องต้น", moduleKey: "settings", newBtn: false },
    users: { title: "ผู้ใช้", desc: "จัดการผู้ใช้", moduleKey: "users", newBtn: false },
    dashboard: { title: "Dashboard", desc: "", moduleKey: "dashboard", newBtn: false },
  };

  const applyRoute = (h) => {
    if (!h) return;
    const x = h.startsWith("#") ? h : `#${h}`;
    if (location.hash === x) return renderRoute();
    location.hash = x;
  };

  const setNavActive = (hash) => {
    const norm = normalizeHash(hash);
    $$(".nav-item").forEach((a) => {
      const href = (a.getAttribute("href") || "").trim();
      const idx = href.indexOf("#");
      const h = idx >= 0 ? href.slice(idx) : "#folders";
      a.classList.toggle("active", normalizeHash(h) === norm);
    });
  };

  // logout bind
  const bindLogoutOnce = () => {
    const btn = $("btnLogout");
    if (!btn) return;
    if (btn.dataset.boundLogout === "1") return;
    btn.dataset.boundLogout = "1";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.api?.logoutAndRedirect) return window.api.logoutAndRedirect();
      clearSession();
      location.href = "./index.html";
    });
  };

  const renderRoute = async () => {
    try {
      assertLayout();
      bindLogoutOnce();

      cleanupBeforeRoute();

      const key = normalizeHash(location.hash).replace(/^#/, "") || "folders";
      const route = ROUTES[key] || ROUTES.folders;

      setNavActive(`#${key}`);
      setText(route.title, route.desc);
      setUpdatedNow();

      setBtnNewVisible(!!route.newBtn, route.newLabel || "+ เพิ่มใหม่");
      setLoadingIntoLeft(route.title);

      window.pages = window.pages || {};

      const page = window.pages[route.moduleKey];
      if (!page || typeof page.load !== "function") {
        throw new Error(`ไม่พบ window.pages.${route.moduleKey}.load`);
      }

      await page.load({
        ENDPOINTS,
        $,
        $$,
        apiFetch,
        getToken,
        applyRoute,
        showDetail,
        setUpdatedNow,
        route: { key },
      });

      autoHideRightPanelIfEmpty();
      setUpdatedNow();
    } catch (e) {
      console.error(e);
      setErrorIntoLeft("โหลดหน้าไม่สำเร็จ", e);
    }
  };

  // ให้หน้าอื่นเรียกเพื่อรีเฟรช
  window.addEventListener("force-render-route", renderRoute);

  // Boot
  window.addEventListener("hashchange", renderRoute);
  if (!location.hash) location.hash = "#folders";

  // ✅ สำคัญ: โหลดข้อมูลผู้ใช้ก่อน ให้ header ถูกทุกหน้า
  loadUserBox();

  renderRoute();
})();