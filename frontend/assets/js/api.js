// frontend/assets/js/api.js
(function () {
  const api = (window.api = window.api || {});

  // =========================
  // Token helpers
  // =========================
  api.getToken = function getToken() {
    return localStorage.getItem("token") || "";
  };

  api.setToken = function setToken(token) {
    if (!token) {
      localStorage.removeItem("token");
      return;
    }
    const t = String(token).trim().replace(/^Bearer\s+/i, "");
    localStorage.setItem("token", t);
  };

  api.logoutAndRedirect = function logoutAndRedirect() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (!location.pathname.endsWith("/index.html")) {
      location.href = "./index.html";
    }
  };

  // =========================
  // Internal helpers
  // =========================
  function withAuthHeader(headers) {
    const h = new Headers(headers || {});
    const token = api.getToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
  }

  function isFormData(x) {
    return typeof FormData !== "undefined" && x instanceof FormData;
  }

  function isAbsoluteUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  function normalizeUrl(url) {
    const u = String(url || "").trim();
    if (!u) return u;
    if (isAbsoluteUrl(u)) return u;
    if (u.startsWith("/")) return u;
    return u;
  }

  async function readTextSafe(res) {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }

  function extractErrorMessage(res, text) {
    try {
      const j = text ? JSON.parse(text) : null;
      if (j && typeof j === "object") {
        if (j.message) return String(j.message);
        if (j.error) return typeof j.error === "string" ? j.error : "เกิดข้อผิดพลาด";
      }
    } catch {}

    const t = String(text || "").trim();
    if (t) return t;

    return `Request failed (${res.status})`;
  }

  // =========================
  // JSON API fetch
  // =========================
  api.apiFetch = async function apiFetch(url, opts = {}) {
    const finalUrl = normalizeUrl(url);
    const method = String(opts.method || "GET").toUpperCase();

    let body = opts.body;
    const headers = withAuthHeader(opts.headers);

    if (body && typeof body === "object" && !isFormData(body)) {
      if (!headers.get("Content-Type")) headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    const res = await fetch(finalUrl, { ...opts, method, headers, body });

    if (res.status === 401) {
      api.logoutAndRedirect();
      throw new Error("ต้องเข้าสู่ระบบใหม่");
    }

    const text = await readTextSafe(res);

    if (res.ok) {
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { ok: true, text };
      }
    }

    const msg = extractErrorMessage(res, text);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  };

  // =========================
  // Multipart/form-data fetch
  // =========================
  api.formFetch = async function formFetch(url, { method = "POST", formData, headers } = {}) {
    const finalUrl = normalizeUrl(url);
    if (!formData || !isFormData(formData)) {
      throw new Error("formFetch ต้องส่ง formData เป็น FormData");
    }

    const h = withAuthHeader(headers);
    if (h.get("Content-Type")) h.delete("Content-Type");

    const res = await fetch(finalUrl, {
      method: String(method || "POST").toUpperCase(),
      headers: h,
      body: formData,
    });

    if (res.status === 401) {
      api.logoutAndRedirect();
      throw new Error("ต้องเข้าสู่ระบบใหม่");
    }

    const text = await readTextSafe(res);

    if (res.ok) {
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { ok: true, text };
      }
    }

    const msg = extractErrorMessage(res, text);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  };

  // =========================
  // ✅ Settings API (CRUD)
  // =========================
  // เพิ่ม/เช็คเฉพาะส่วน settings ใน api.js
api.settings = api.settings || {};
const BASE = "/api/settings";
const urlDocTypes = `${BASE}/document-types`;
const urlItJobs = `${BASE}/it-job-types`;

api.settings.documentTypes = {
  list: ({ include_inactive = true } = {}) => api.apiFetch(`${urlDocTypes}${include_inactive ? "?include_inactive=1" : ""}`),
  create: (payload) => api.apiFetch(urlDocTypes, { method: "POST", body: payload }),
  update: (id, payload) => api.apiFetch(`${urlDocTypes}/${encodeURIComponent(id)}`, { method: "PATCH", body: payload }),
  remove: (id) => api.apiFetch(`${urlDocTypes}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

api.settings.itJobTypes = {
  list: ({ include_inactive = true } = {}) => api.apiFetch(`${urlItJobs}${include_inactive ? "?include_inactive=1" : ""}`),
  create: (payload) => api.apiFetch(urlItJobs, { method: "POST", body: payload }),
  update: (id, payload) => api.apiFetch(`${urlItJobs}/${encodeURIComponent(id)}`, { method: "PATCH", body: payload }),
  remove: (id) => api.apiFetch(`${urlItJobs}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
})();