(function () {
  function parseHash() {
    // รองรับ: #documents?folder_id=12
    const raw = (location.hash || "#folders").replace(/^#/, "");
    const [path, qs] = raw.split("?");
    const query = {};
    if (qs) {
      const sp = new URLSearchParams(qs);
      sp.forEach((v, k) => (query[k] = v));
    }
    return { path: path || "folders", query };
  }

  async function applyRoute() {
    const { path, query } = parseHash();

    // active menu (ถ้ามี data-route)
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-route") === path);
    });

    if (!window.pages || !window.pages[path] || typeof window.pages[path].load !== "function") {
      console.warn("Route not found:", path);
      return;
    }

    const ENDPOINTS = {
      folders: "/folders",
      documents: "/documents",
      trash: "/documents/trash",
      login: "/auth/login",
    };

    // helper minimal
    const $ = (sel) => document.querySelector(sel);

    const showDetail = (title, html) => {
      const box = $("#detailBox");
      if (!box) return;
      box.innerHTML = `
        <div class="detail-title">${title || ""}</div>
        <div class="detail-body">${html || ""}</div>
      `;
    };

    const setUpdatedNow = () => {
      const el = $("#updatedNow");
      if (el) el.textContent = new Date().toLocaleString();
    };

    const getToken = () => localStorage.getItem("token") || "";

    // main render area (พยายามยืดหยุ่นกับหน้าเดิมของคุณ)
    const content = $("#pageContent") || $("#content") || $("#appContent") || document.body;

    // ให้ page เขียน content เอง โดยส่ง content ไป
    await window.pages[path].load({
      ENDPOINTS,
      $,
      content,
      showDetail,
      setUpdatedNow,
      getToken,
      applyRoute,
      query,
    });
  }

  window.router = { applyRoute };

  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("DOMContentLoaded", () => {
    // ผูก click เมนูถ้ามี data-route
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = `#${el.getAttribute("data-route")}`;
      });
    });

    // logout ปุ่ม (ถ้ามี id=btnLogout)
    const btnLogout = document.querySelector("#btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        localStorage.removeItem("token");
        location.href = "/login.html";
      });
    }

    applyRoute();
  });
})();
