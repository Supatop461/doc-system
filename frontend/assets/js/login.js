(() => {
  // =========================
  // CONFIG
  // =========================
  // ถ้าเปิดผ่าน http://localhost:3000 (serve static จาก backend) -> ใช้ same-origin จะชัวร์สุด
  // ถ้าเปิดผ่าน file:// หรือคนละพอร์ต -> fallback เป็น http://localhost:3000
  const DEFAULT_API_ORIGIN = "http://localhost:3000";
  const API_ORIGIN =
    window.API_ORIGIN ||
    (location?.origin && location.origin !== "null" ? location.origin : DEFAULT_API_ORIGIN);

  const LOGIN_PATH = "/api/auth/login"; // ✅ backend route
  const TOKEN_KEY = "token";
  const USER_KEY = "user";

  // =========================
  // Utilities
  // =========================
  const $ = (id) => document.getElementById(id);

  function setMsg(el, msg, type = "info") {
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = type === "error" ? "#d62828" : "#4b0030";
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // fetch + timeout + parse error ให้เป็น message อ่านง่าย
  async function fetchJSON(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s

    try {
      const res = await fetch(`${API_ORIGIN}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        // รองรับรูปแบบ {message}, {error}, หรือข้อความ plain
        const msg =
          data?.message ||
          data?.error ||
          (typeof data === "string" ? data : "") ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      // network / timeout
      if (err?.name === "AbortError") {
        throw new Error("เชื่อมต่อเซิร์ฟเวอร์นานเกินไป (timeout)");
      }
      // ถ้า backend ไม่รัน / CORS / หาพอร์ตไม่เจอ
      if (String(err?.message || "").includes("Failed to fetch")) {
        throw new Error(`เชื่อมต่อ API ไม่ได้ (${API_ORIGIN}) — เช็คว่า backend รันอยู่ที่พอร์ต 3000`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // =========================
  // Detect login elements (ให้ยืดหยุ่นกับ HTML)
  // =========================
  function detectLoginElements() {
    const form = $("loginForm") || document.querySelector("form");
    const usernameEl =
      $("username") ||
      document.querySelector('input[name="username"]') ||
      document.querySelector('input[type="text"]');

    const passwordEl =
      $("password") ||
      document.querySelector('input[name="password"]') ||
      document.querySelector('input[type="password"]');

    const messageEl = $("error") || $("loginMessage") || document.querySelector('[data-role="message"]');

    const submitBtn =
      $("loginBtn") ||
      $("btnLogin") ||
      (form ? form.querySelector('button[type="submit"]') : null);

    return { form, usernameEl, passwordEl, messageEl, submitBtn };
  }

  // =========================
  // Login handler
  // =========================
  async function handleLogin(username, password) {
    const payload = { username, password };

    // backend ควรคืน { token, user:{id, username, role} }
    const data = await fetchJSON(LOGIN_PATH, { method: "POST", body: payload });

    if (!data?.token) throw new Error("ไม่พบ token จากเซิร์ฟเวอร์");

    setToken(data.token);
    if (data?.user) setUser(data.user);

    // ✅ หลัง login สำเร็จไปหน้า dashboard
    // (ถ้าไฟล์คุณชื่ออื่น เปลี่ยนตรงนี้ได้)
    window.location.href = "./dashboard.html";
  }

  // =========================
  // Boot
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    // ถ้ามี token แล้ว ไม่ต้องอยู่หน้า login
    if (getToken()) {
      window.location.href = "./dashboard.html";
      return;
    }

    const { form, usernameEl, passwordEl, messageEl, submitBtn } = detectLoginElements();
    if (!form || !usernameEl || !passwordEl) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(messageEl, "");

      const username = (usernameEl.value || "").trim();
      const password = (passwordEl.value || "").trim();

      if (!username || !password) {
        setMsg(messageEl, "กรุณากรอกข้อมูลให้ครบ", "error");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "กำลังเข้าสู่ระบบ...";
        }
        setMsg(messageEl, "กำลังเข้าสู่ระบบ...");
        await handleLogin(username, password);
      } catch (err) {
        setMsg(messageEl, err?.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "เข้าสู่ระบบ";
        }
      }
    });
  });
})();
