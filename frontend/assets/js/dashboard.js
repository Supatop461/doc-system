// ===============================
// frontend/assets/js/dashboard.js
// ===============================

const API_BASE = "http://localhost:3000";
const SUMMARY_ENDPOINT = "/dashboard/summary";
const LOGIN_PAGE = "./index.html";

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("th-TH").format(Number(n || 0));

function clamp(n, a, b) {
  n = Number(n || 0);
  return Math.max(a, Math.min(b, n));
}

function toThaiDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("th-TH");
}

function setUpdatedNow() {
  const now = new Date().toLocaleString("th-TH");
  const el = $("lastUpdated");
  if (el) el.textContent = "อัปเดตล่าสุด: " + now;

  const hero = $("heroUpdated");
  if (hero) hero.textContent = "อัปเดตล่าสุด: " + now;
}

function redirectToLogin() {
  window.location.href = LOGIN_PAGE;
}

function getToken() {
  if (window.api?.getToken) return window.api.getToken();
  return localStorage.getItem("token");
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

(function guard() {
  const token = getToken();
  if (!token) redirectToLogin();
})();

// ✅ ดึง user จาก token จริงผ่าน /api/me แล้วแสดง:
// [บนสุด]=รหัสพนักงาน, รหัส:=id, ROLE:=role
async function loadUserBox() {
  try {
    const token = getToken();
    if (!token) return redirectToLogin();

    const res = await fetch(`${API_BASE}/api/me`, {
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

    // ✅ บนสุด = รหัสพนักงาน (ถ้ามี) ไม่มีก็ fallback เป็น username แล้วค่อย id
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

async function apiGet(fullUrl) {
  if (typeof window.apiFetch === "function") {
    return await window.apiFetch(fullUrl, { method: "GET" });
  }

  const token = getToken();
  const res = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 || res.status === 403) {
    clearSession();
    redirectToLogin();
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data || {};
}

async function fetchDashboardSummary() {
  return await apiGet(API_BASE + SUMMARY_ENDPOINT);
}

function pickFileIcon(name = "") {
  const n = String(name || "").toLowerCase();
  const ext = (n.split(".").pop() || "").trim();
  if (!ext || ext === n) return "📄";
  if (ext === "pdf") return "🟥";
  if (["doc", "docx"].includes(ext)) return "🟦";
  if (["xls", "xlsx", "csv"].includes(ext)) return "🟩";
  if (["ppt", "pptx"].includes(ext)) return "🟧";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "🖼️";
  return "📄";
}

function ellipsis(s, max = 56) {
  s = String(s || "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ✅ ตัด “ยอดเข้าดูวันนี้” ออกถาวร เหลือ 3 KPI เท่านั้น
function renderKpi(kpi) {
  const docs = Number(kpi?.documents || 0);
  const folders = Number(kpi?.folders || 0);
  const files = Number(kpi?.files || 0);

  if ($("kDocs")) $("kDocs").textContent = fmt(docs);
  if ($("kFolders")) $("kFolders").textContent = fmt(folders);
  if ($("kFiles")) $("kFiles").textContent = fmt(files);

  renderCharts({ docs, folders, files });
}

function renderCharts({ docs, folders, files }) {
  const donutWrap = $("donutWrap");
  const donutLegend = $("donutLegend");
  const barWrap = $("barWrap");
  if (!donutWrap || !donutLegend || !barWrap) return;

  const items = [
    { label: "เอกสาร", value: docs, cls: "seg-docs" },
    { label: "แฟ้ม", value: folders, cls: "seg-folders" },
    { label: "ไฟล์แนบ", value: files, cls: "seg-files" },
  ].filter((x) => Number(x.value || 0) > 0);

  const total = items.reduce((s, x) => s + Number(x.value || 0), 0);

  if (!total) {
    donutWrap.innerHTML = `
      <div class="empty-viz">
        <div class="empty-emoji">✨</div>
        <div class="empty-title">ยังไม่มีข้อมูลพอสำหรับกราฟ</div>
        <div class="empty-sub">เพิ่มเอกสาร/แฟ้ม แล้วกลับมาดูอีกครั้ง</div>
      </div>`;
    donutLegend.innerHTML = "";
    barWrap.innerHTML = "";
    return;
  }

  const size = 180;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const segs = items.map((it) => {
    const frac = Number(it.value) / total;
    const dash = frac * c;
    const seg = `
      <circle class="donut-seg ${it.cls}"
        cx="${size / 2}" cy="${size / 2}" r="${r}"
        stroke-dasharray="${dash} ${c - dash}"
        stroke-dashoffset="${-offset}"
      />`;
    offset += dash;
    return seg;
  });

  donutWrap.innerHTML = `
    <div class="donut">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="สัดส่วนข้อมูล">
        <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${r}" />
        ${segs.join("")}
      </svg>
      <div class="donut-center">
        <div class="donut-total">${fmt(total)}</div>
        <div class="donut-sub">รวมรายการ</div>
      </div>
    </div>
  `;

  donutLegend.innerHTML = items
    .map((it) => {
      const pct = Math.round((Number(it.value) / total) * 100);
      return `
        <div class="legend-row">
          <span class="legend-dot ${it.cls}" aria-hidden="true"></span>
          <div class="legend-main">
            <div class="legend-label">${it.label}</div>
            <div class="legend-meta">${fmt(it.value)} • ${pct}%</div>
          </div>
        </div>
      `;
    })
    .join("");

  const maxVal = Math.max(...items.map((x) => Number(x.value || 0)), 1);
  barWrap.innerHTML = items
    .map((it) => {
      const w = clamp((Number(it.value) / maxVal) * 100, 6, 100);
      return `
        <div class="bar-row">
          <div class="bar-left">
            <span class="bar-dot ${it.cls}" aria-hidden="true"></span>
            <span class="bar-label">${it.label}</span>
          </div>
          <div class="bar-mid">
            <div class="bar-track">
              <div class="bar-fill ${it.cls}" style="width:${w}%"></div>
            </div>
          </div>
          <div class="bar-right">${fmt(it.value)}</div>
        </div>
      `;
    })
    .join("");
}

function renderLatestDocs(items) {
  const el = $("latestDocs");
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `
      <div class="empty-list">
        <div class="empty-emoji">🗃️</div>
        <div class="empty-title">ยังไม่มีเอกสาร</div>
        <div class="empty-sub">เริ่มจากอัปโหลดเอกสาร หรือเพิ่มเอกสารใหม่ในหน้า “เอกสารทั้งหมด”</div>
      </div>
    `;
    return;
  }

  el.innerHTML = items
    .map((d) => {
      const name = d.original_file_name || d.title || d.file_name || "-";
      const icon = pickFileIcon(name);

      const subBits = [d.folder_name, d.document_type_name].filter(Boolean);
      const sub = subBits.join(" • ");

      const updated = d.updated_at || d.updatedAt || d.created_at || d.createdAt || null;
      const time = updated ? toThaiDateTime(updated) : null;

      return `
        <a class="doc-card" href="./app.html#all" title="${String(name).replaceAll('"', "&quot;")}">
          <div class="doc-ico" aria-hidden="true">${icon}</div>
          <div class="doc-main">
            <div class="doc-title">${ellipsis(name, 56)}</div>
            <div class="doc-subline">${sub || "—"}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-badge">${(d.document_type_name || "DOC").toString().slice(0, 12)}</div>
            <div class="doc-time">${time || ""}</div>
          </div>
        </a>
      `;
    })
    .join("");
}

async function loadDashboard() {
  const data = await fetchDashboardSummary();
  renderKpi(data.kpi || {});
  renderLatestDocs(data.latestDocuments || []);
  setUpdatedNow();
}

(function bindEvents() {
  const btnLogout = $("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      clearSession();
      redirectToLogin();
    });
  }
})();

loadUserBox();
loadDashboard().catch((err) => {
  console.error(err);
  alert(err.message || "โหลด Dashboard ไม่สำเร็จ");
});