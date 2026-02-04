// frontend/assets/js/api.js
(() => {
  // =========================
  // CONFIG
  // =========================
  const TOKEN_KEY = "token";
  const USER_KEY = "user";

  // ถ้าเปิดผ่าน backend ที่ serve static (แนะนำ) => same-origin
  // ถ้าเปิดผ่าน file:// หรือพอร์ตอื่น => fallback ไป localhost:3000
  const DEFAULT_API_ORIGIN = "http://localhost:3000";
  const API_ORIGIN =
    window.API_ORIGIN ||
    (location?.origin && location.origin !== "null" ? location.origin : DEFAULT_API_ORIGIN);

  // หน้า login ของคุณในโปรเจกต์นี้คือ index.html
  const LOGIN_PAGE = "./index.html";

  // =========================
  // AUTH
  // =========================
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logoutAndRedirect() {
    clearAuth();
    window.location.href = LOGIN_PAGE;
  }

  // =========================
  // CORE FETCH
  // =========================
  async function apiFetch(path, options = {}) {
    const token = getToken();

    // clone headers
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    // ถ้า path เป็น absolute (http...) ให้ใช้ตามนั้น
    // ถ้าเป็น relative (/api/...) จะ prefix ด้วย API_ORIGIN
    const url = /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // 401 => token หมด/ไม่ผ่านสิทธิ์
      if (res.status === 401) {
        logoutAndRedirect();
        throw new Error("UNAUTHORIZED");
      }

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (typeof data === "string" ? data : "") ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error("เชื่อมต่อเซิร์ฟเวอร์นานเกินไป (timeout)");
      }
      if (String(err?.message || "").includes("Failed to fetch")) {
        throw new Error(`เชื่อมต่อ API ไม่ได้ (${API_ORIGIN}) — เช็คว่า backend รันที่พอร์ต 3000`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // =========================
  // HELPERS
  // =========================
  async function jsonFetch(path, { method = "POST", body = {}, headers = {}, ...rest } = {}) {
    return apiFetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      ...rest,
    });
  }

  // สำหรับ multipart/form-data (upload)
  async function formFetch(path, { method = "POST", formData, headers = {}, ...rest } = {}) {
    // ห้าม set Content-Type เอง เพราะ browser ต้องใส่ boundary ให้
    return apiFetch(path, {
      method,
      headers: { ...headers },
      body: formData,
      ...rest,
    });
  }

  // =========================
  // Documents API
  // =========================
  const documents = {
    // รองรับ folder_id ถ้ามี
    list: (opts = {}) => {
      const { folder_id } = opts || {};
      const qs = folder_id ? `?folder_id=${encodeURIComponent(folder_id)}` : "";
      return apiFetch(`/api/documents${qs}`);
    },
    get: (id) => apiFetch(`/api/documents/${encodeURIComponent(id)}`),
    delete: (id) => apiFetch(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
    restore: (id) => apiFetch(`/api/documents/${encodeURIComponent(id)}/restore`, { method: "POST" }),

    // upload (ถ้า backend ของคุณใช้ /api/documents/upload หรือ /api/documents)
    // เดี๋ยวหน้า documents.page.js ค่อยเรียกให้ตรง route จริงอีกที
    upload: ({ file, folder_id, title, description } = {}) => {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (folder_id != null) fd.append("folder_id", folder_id);
      if (title != null) fd.append("title", title);
      if (description != null) fd.append("description", description);

      // ปรับ path ให้ตรง backend ของคุณ (ถ้าเป็น /api/documents/upload ให้เปลี่ยนตรงนี้)
      return formFetch("/api/documents/upload", { method: "POST", formData: fd });
    },

    downloadUrl: (id) => `${API_ORIGIN}/api/documents/${encodeURIComponent(id)}/download`,
    previewUrl: (id) => `${API_ORIGIN}/api/documents/${encodeURIComponent(id)}/preview`,
  };

  // =========================
  // Trash API
  // =========================
  const trash = {
    list: () => apiFetch("/api/trash"),
    restore: (id) => apiFetch(`/api/trash/${encodeURIComponent(id)}/restore`, { method: "POST" }),
    delete: (id) => apiFetch(`/api/trash/${encodeURIComponent(id)}`, { method: "DELETE" }),
    empty: () => apiFetch("/api/trash", { method: "DELETE" }),
  };

  // =========================
  // Settings API
  // =========================
  const settings = {
    documentTypes: {
      list: (opts = {}) => {
        const qs = opts.include_inactive ? "?include_inactive=1" : "";
        return apiFetch(`/api/document-types${qs}`);
      },
      create: ({ name, is_active = true } = {}) =>
        jsonFetch("/api/document-types", {
          method: "POST",
          body: { name, is_active },
        }),
    },
    itJobTypes: {
      list: (opts = {}) => {
        const qs = opts.include_inactive ? "?include_inactive=1" : "";
        return apiFetch(`/api/it-job-types${qs}`);
      },
      create: ({ name, is_active = true } = {}) =>
        jsonFetch("/api/it-job-types", {
          method: "POST",
          body: { name, is_active },
        }),
    },
  };

  // =========================
  // expose
  // =========================
  window.apiFetch = apiFetch;
  window.api = {
    API_ORIGIN,

    // auth
    getToken,
    getUser,
    setToken,
    setUser,
    clearAuth,
    logoutAndRedirect,

    // fetchers
    apiFetch,
    jsonFetch,
    formFetch,

    // apis
    documents,
    trash,
    settings,
  };
})();
