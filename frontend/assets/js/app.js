// frontend/assets/js/app.js (FINAL - use app.html layout only, no #appView injection)
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
    // optional (ถ้ามีใน backend ของคุณ)
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

    // id
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
  // API / Auth
  // =========================
  const getToken = () => localStorage.getItem("token") || "";

  const apiFetch = async (url, opts = {}) => {
    const token = getToken();
    const headers = new Headers(opts.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      if (!headers.get("Content-Type")) headers.set("Content-Type", "application/json");
      opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
    return data;
  };

  window.api = window.api || {};
  window.api.apiFetch = apiFetch;

  // =========================
  // Layout refs (อิง app.html ของคุณ)
  // =========================
  const leftTitle = () => $("leftTitle");
  const leftBadge = () => $("leftBadge");
  const leftBody = () => $("leftBody");

  const rightTitle = () => $("rightTitle");
  const rightHint = () => $("rightHint");
  const rightBody = () => $("rightBody");

  const pageTitle = () => $("pageTitle");
  const pageDesc = () => $("pageDesc");

  const lastUpdated = () => $("lastUpdated");

  // ต้องมีใน app.html ไม่งั้นให้ขึ้น error ชัดๆ
  const assertLayout = () => {
    if (!leftBody() || !rightBody()) {
      throw new Error("ไม่พบโครง layout (leftBody/rightBody) ใน app.html");
    }
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
    if (el) el.textContent = `อัปเดตล่าสุด: ${new Date().toLocaleString()}`;
  };

  const showDetail = (html) => {
    if (rightBody()) rightBody().innerHTML = html ?? "";
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
          <div style="font-weight:900;color:#b91c1c;">${esc(title || "เกิดข้อผิดพลาด")}</div>
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
  // ⭐ Cleanup: ของใครของมัน
  // =========================
  const cleanupBeforeRoute = () => {
    // 1) ซ่อน “ตารางตัวอย่าง/โครงสำหรับต่อ API” ไม่ให้ตามทุกหน้า
    const panelBottom = $(".panel.panel-bottom");
    if (panelBottom) panelBottom.style.display = "none";

    // 2) เคลียร์ tableBody เผื่อเคยยัดไว้
    const tb = $("tableBody");
    if (tb) tb.innerHTML = "";

    // 3) ปิด upload modal ถ้าค้าง (ของเรา)
    const uploadOverlay = $("uploadModalOverlay");
    if (uploadOverlay) uploadOverlay.style.display = "none";

    // 4) reset detail (✅ เอาข้อความ “คลิกแถวเพื่อดูรายละเอียด” ออก)
    if (rightTitle()) rightTitle().innerHTML = "";
    if (rightHint()) rightHint().innerHTML = "";
    if (rightBody()) rightBody().innerHTML = "";

    // ✅ สำคัญ: ล้าง event เดิมของปุ่ม btnNew เพื่อไม่ให้คลิกซ้ำ/ค้างจากหน้าก่อน
    const btn = $("btnNew");
    if (btn && btn.parentNode) {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    }
  };

  // คุมปุ่ม + เพิ่มใหม่ ให้ขึ้นเฉพาะหน้าที่ใช้
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

  // ✅ ระบุชัด: หน้าไหนมีปุ่มเพิ่มใหม่
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
    users: { title: "ผู้ใช้", desc: "จัดการผู้ใช้ (เปิด/ปิดการใช้งาน)", moduleKey: "users", newBtn: false },
    dashboard: { title: "Dashboard", desc: "", moduleKey: "dashboard", newBtn: false },
  };

  const loadedScripts = new Set();
  const loadScriptOnce = (src) =>
    new Promise((resolve, reject) => {
      if (loadedScripts.has(src)) return resolve(true);

      const already = $$("script").some((s) => (s.getAttribute("src") || "").includes(src));
      if (already) {
        loadedScripts.add(src);
        return resolve(true);
      }

      const s = document.createElement("script");
      s.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`);
      s.defer = true;
      s.onload = () => {
        loadedScripts.add(src);
        resolve(true);
      };
      s.onerror = () => reject(new Error(`โหลดไฟล์ไม่สำเร็จ: ${src}`));
      document.head.appendChild(s);
    });

  // ✅ inject css once
  const ensureCssOnce = (href) => {
    const exist = Array.from(document.querySelectorAll("link[rel='stylesheet']")).some((l) =>
      (l.getAttribute("href") || "").includes(href)
    );
    if (exist) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href + (href.includes("?") ? "" : `?v=${Date.now()}`);
    document.head.appendChild(link);
  };

  // ✅ ให้ modal upload ทำงานทุกหน้า (โหลดครั้งเดียว)
  const ensureUploadModalReady = async () => {
    ensureCssOnce("assets/css/documents-upload.modal.css");
    await loadScriptOnce("assets/js/modals/documents-upload.modal.js");
  };

  const applyRoute = (h) => {
    if (!h) return;
    const x = h.startsWith("#") ? h : `#${h}`;
    if (location.hash === x) return renderRoute();
    location.hash = x;
  };

  const setNavActive = (hash) => {
    const norm = normalizeHash(hash);
    // ของคุณเป็น <a href="./app.html#xxx">
    $$(".nav-item").forEach((a) => {
      const href = (a.getAttribute("href") || "").trim();
      const idx = href.indexOf("#");
      const h = idx >= 0 ? href.slice(idx) : "#folders";
      a.classList.toggle("active", normalizeHash(h) === norm);
    });
  };

  // ✅ logout bind (ของจริงใช้ window.api.logoutAndRedirect จาก api.js)
  const bindLogoutOnce = () => {
    const btn = $("btnLogout");
    if (!btn) return;
    if (btn.dataset.boundLogout === "1") return;
    btn.dataset.boundLogout = "1";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.api?.logoutAndRedirect) return window.api.logoutAndRedirect();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "./index.html";
    });
  };

  const renderRoute = async () => {
    try {
      assertLayout();
      bindLogoutOnce(); // ✅ ให้แน่ใจว่ามีทุกหน้า
      await ensureUploadModalReady(); // ✅ ให้ปุ่ม “เพิ่มเอกสาร” เด้ง modal ได้แน่นอน
      cleanupBeforeRoute();

      const key = normalizeHash(location.hash).replace(/^#/, "") || "folders";
      const route = ROUTES[key] || ROUTES.folders;

      setNavActive(`#${key}`);
      setText(route.title, route.desc);
      setUpdatedNow();

      setBtnNewVisible(!!route.newBtn, route.newLabel || "+ เพิ่มใหม่");
      setLoadingIntoLeft(route.title);

      window.pages = window.pages || {};

      if (!window.pages[route.moduleKey]) {
        await loadScriptOnce(`assets/js/pages/${route.moduleKey}.page.js`);
      }

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

      setUpdatedNow();
    } catch (e) {
      console.error(e);
      setErrorIntoLeft("โหลดหน้าไม่สำเร็จ", e);
    }
  };

  // ✅ ให้ modal เรียกเพื่อ “รีเฟรชหน้า” ได้หลังอัปโหลดเสร็จ
  window.addEventListener("force-render-route", renderRoute);

  // =========================
  // Boot
  // =========================
  window.addEventListener("hashchange", renderRoute);
  if (!location.hash) location.hash = "#folders";
  renderRoute();
})();