/**
 * Language Toggle — ID / EN
 * - Injects toggle pill into navbar
 * - Applies data-en / data-id attributes across the page
 * - Translates navbar links via built-in map
 * - Persists choice in localStorage under key "lang"
 */
(function () {
  var DEFAULT = "en";
  var current = localStorage.getItem("lang") || DEFAULT;

  /* ── Navbar text map (EN → ID) ─────────────────────────── */
  var NAV = {
    "Home": "Beranda",
    "About Us": "Tentang Kami",
    "Gallery": "Galeri",
    "Program": "Program",
    "School": "Sekolah",
    "After-School Programme": "Program Setelah Sekolah",
    "Contact Us": "Hubungi Kami",
    "Academic Calendar": "Kalender Akademik",
    "Testimonies": "Testimoni",
    "Login": "Login",
    "Dashboard": "Dashboard",
    "Logout": "Keluar",
    "Pengumuman": "Pengumuman",
  };
  var NAV_EN = {};
  Object.keys(NAV).forEach(function (k) { NAV_EN[NAV[k]] = k; });

  /* ── Apply translations ─────────────────────────────────── */
  function applyLang(lang) {
    // 1. data-en / data-id elements
    document.querySelectorAll("[data-en]").forEach(function (el) {
      var val = el.getAttribute("data-" + lang);
      if (!val) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = val;
      } else {
        el.innerHTML = val;
      }
    });

    // 2. Navbar links
    var map = lang === "id" ? NAV : NAV_EN;
    document.querySelectorAll(
      ".navbar-nav .nav-link, .navbar-nav .nav-item.nav-link"
    ).forEach(function (el) {
      var t = el.textContent.trim();
      if (map[t]) el.textContent = map[t];
    });

    // Program dropdown items — matched by href so multiline HTML never breaks them
    document.querySelectorAll('[href*="school-section"]').forEach(function (el) {
      el.textContent = lang === "id" ? "Sekolah" : "School";
    });
    document.querySelectorAll('[href*="afterschool-section"]').forEach(function (el) {
      el.textContent = lang === "id" ? "Program Setelah Sekolah" : "After-School Programme";
    });
    // Login btn
    document.querySelectorAll(".login-btn").forEach(function (el) {
      el.textContent = lang === "id" ? "Login" : "Login";
    });

    // 3. Update pill buttons
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      var isActive = btn.getAttribute("data-lang") === lang;
      btn.style.background = isActive ? "#9a7b55" : "transparent";
      btn.style.color = isActive ? "#fff" : "#9a7b55";
    });

    current = lang;
  }

  /* ── Toggle ─────────────────────────────────────────────── */
  function setLang(lang) {
    localStorage.setItem("lang", lang);
    applyLang(lang);
  }

  /* ── Inject pill into navbar ─────────────────────────────── */
  function injectPill() {
    if (document.getElementById("langPill")) return;
    var collapse = document.getElementById("navbarCollapse");
    if (!collapse) return;

    var pill = document.createElement("div");
    pill.id = "langPill";
    pill.style.cssText =
      "display:inline-flex;align-items:center;border:1.5px solid #9a7b55;" +
      "border-radius:20px;overflow:hidden;margin:0 12px;flex-shrink:0;";

    ["en", "id"].forEach(function (lang) {
      var btn = document.createElement("button");
      btn.className = "lang-btn";
      btn.setAttribute("data-lang", lang);
      btn.textContent = lang.toUpperCase();
      btn.style.cssText =
        "background:transparent;border:none;padding:4px 11px;font-size:11px;" +
        "font-weight:700;cursor:pointer;color:#9a7b55;font-family:inherit;transition:0.15s;";
      btn.addEventListener("click", function () { setLang(lang); });
      pill.appendChild(btn);
    });

    // Insert before .login-btn, or append
    var loginBtn = collapse.querySelector(".login-btn");
    if (loginBtn) {
      collapse.insertBefore(pill, loginBtn);
    } else {
      collapse.appendChild(pill);
    }
  }

  /* ── Expose globally (pages can call window.setLang) ─────── */
  window.setLang = setLang;

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    injectPill();
    applyLang(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
