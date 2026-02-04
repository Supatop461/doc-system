// ===============================
// frontend/assets/js/dashboard.js
// ===============================

// ===== CONFIG =====
const API_BASE = "http://localhost:3000";
const SUMMARY_ENDPOINT = "/dashboard/summary";
const LOGIN_PAGE = "./index.html";

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("th-TH").format(Number(n || 0));

function toThaiDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("th-TH");
}

function setUpdatedNow() {
  const el = $("lastUpdated");
  if (el) el.textContent = "อัปเดตล่าสุด: " + new Date().toLocaleString("th-TH");
}

function redirectToLogin() {
  window.location.href = LOGIN_PAGE;
}

function getToken() {
  // ถ้ามี api.js ที่ expose window.api.getToken ให้ใช้
  if (window.api?.getToken) return window.api.getToken();
  return localStorage.getItem("token");
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// ===== Guard: ต้องล็อกอินก่อน =====
(function guard() {
  const token = getToken();
  if (!token) redirectToLogin();
})();

// ===== โหลดข้อมูล user จาก localStorage (อิง response login จริงของคุณ) =====
function loadUserBox() {
  const raw = localStorage.getItem("user");
  let user = {};
  try {
    user = raw ? JSON.parse(raw) : {};
  } catch {
    user = {};
  }

  // backend คุณส่ง { id, username, role }
  const username = user.username || "แอดมิน";
  const role = String(user.role || "ADMIN").toUpperCase();

  const elName = $("userName");
  const elCode = $("userCode");
  const elRole = $("userRole");

  if (elName) elName.textContent = username;
  if (elCode) elCode.textContent = username;
  if (elRole) elRole.textContent = role;
}

/**
 * apiGet: ใช้ window.apiFetch ถ้ามี (จะได้ parse/error/401 handling ดีขึ้น)
 * แต่ยังรองรับ fallback แบบ fetch ตรง (ของเดิม)
 */
async function apiGet(fullUrl) {
  // ถ้ามี apiFetch ให้ใช้ (และส่ง absolute URL ได้)
  if (typeof window.apiFetch === "function") {
    try {
      return await window.apiFetch(fullUrl, { method: "GET" });
    } catch (err) {
      // ถ้า apiFetch โยน UNAUTHORIZED มา ให้เคลียร์แล้วเด้ง
      if (String(err?.message || "").includes("UNAUTHORIZED")) {
        clearSession();
        redirectToLogin();
      }
      throw err;
    }
  }

  // fallback: fetch ตรง
  const token = getToken();
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    clearSession();
    redirectToLogin();
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  const ct = res.headers.get("content-type") || "";
  let data = null;

  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data || {};
}

// ===== Fetch Dashboard Summary (ของจริง) =====
async function fetchDashboardSummary() {
  const url = API_BASE + SUMMARY_ENDPOINT;
  return await apiGet(url);
}

// ===== Render (ให้ตรงกับ API response จริง) =====
function renderKpi(kpi) {
  const kDocs = $("kDocs");
  const kFolders = $("kFolders");
  const kFiles = $("kFiles");
  const kViewsToday = $("kViewsToday");

  if (kDocs) kDocs.textContent = fmt(kpi.documents);
  if (kFolders) kFolders.textContent = fmt(kpi.folders);
  if (kFiles) kFiles.textContent = fmt(kpi.files);
  if (kViewsToday) kViewsToday.textContent = fmt(kpi.viewsToday);
}

function renderLatestDocs(items) {
  const el = $("latestDocs");
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `<div style="color:rgba(75,0,48,.55)">ยังไม่มีเอกสาร</div>`;
    return;
  }

  el.innerHTML = items
    .map((d) => {
      const sub = [
        d.document_type_name || null,
        d.folder_name || null,
        d.original_file_name || null,
      ]
        .filter(Boolean)
        .join(" • ");

      const badge = d.document_type_name || "DOC";

      return `
        <div class="doc-row">
          <div class="doc-left">
            <div class="doc-id">${d.document_id ?? "-"}</div>
            <div class="doc-sub">${sub || "-"}</div>
          </div>
          <div class="badge">${badge}</div>
        </div>
      `;
    })
    .join("");
}

function renderLatestActs(items) {
  const el = $("latestActs");
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `<div style="color:rgba(75,0,48,.55)">ยังไม่มีกิจกรรม</div>`;
    return;
  }

  el.innerHTML = items
    .map(
      (a) => `
      <div class="act-item">
        <div class="act-title">👁️ ${a.title || "-"}</div>
        <div class="act-meta">
          ${(a.doc || "-")} • โดย ${(a.by || "-")}<br/>
          ${toThaiDateTime(a.when)}
        </div>
      </div>
    `
    )
    .join("");
}

// ===== Load จริง =====
async function loadDashboard() {
  const data = await fetchDashboardSummary();
  renderKpi(data.kpi || {});
  renderLatestDocs(data.latestDocuments || []);
  renderLatestActs(data.latestActivities || []);
  setUpdatedNow();
}

// ===== Events =====
(function bindEvents() {
  const btnLogout = $("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  }

  const btnRefresh = $("btnRefresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      btnRefresh.disabled = true;
      try {
        await loadDashboard();
      } catch (err) {
        console.error(err);
        alert(err.message || "โหลดข้อมูลใหม่ไม่สำเร็จ");
      } finally {
        btnRefresh.disabled = false;
      }
    });
  }
})();

// init
loadUserBox();
loadDashboard().catch((err) => {
  console.error(err);
  alert(err.message || "โหลด Dashboard ไม่สำเร็จ");
});
