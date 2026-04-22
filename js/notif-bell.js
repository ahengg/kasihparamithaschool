/**
 * Notification Bell — tracks read articles per-user in Supabase (cross-device).
 * localStorage is used as a fast cache; DB is source of truth.
 */
(function () {
  var SUPABASE_URL = window.__SUPABASE.URL;
  var SUPABASE_ANON = window.__SUPABASE.ANON;

  var _readCache = null; // in-memory Set, populated on first getReadIds()

  // ── Visibility: link "Academic Calendar" hanya untuk role=user ──
  // Berlaku di semua halaman karena notif-bell.js loaded di semua page.
  function applyCalendarVisibility() {
    var role = localStorage.getItem("role") || "";
    var token = localStorage.getItem("access_token");
    var isUser = !!token && role === "user";
    document.querySelectorAll('a[href*="kalenderakademik.html"]').forEach(function (el) {
      el.style.display = isUser ? "" : "none";
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCalendarVisibility);
  } else {
    applyCalendarVisibility();
  }

  function init() {
    var bellLink = document.querySelector(".notif-link");
    if (!bellLink) return;
    var wrapper = bellLink.closest(".nav-item.dropdown");
    if (!wrapper) return;

    var token = localStorage.getItem("access_token");
    if (!token) {
      wrapper.style.display = "none";
      return;
    }

    var loc = window.location.pathname.toLowerCase();
    var isSubDir = loc.indexOf("/admin/") !== -1 || loc.indexOf("/login/") !== -1;
    var prefix = isSubDir ? "../" : "";

    var style = document.createElement("style");
    style.textContent =
      ".notif-link{position:relative}" +
      ".notif-badge{display:none;position:absolute;top:2px;right:-4px;background:#e53935;color:#fff !important;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px;line-height:1;pointer-events:none}" +
      ".notif-dropdown{width:320px;padding:0;min-width:0}" +
      "@media(max-width:576px){.notif-dropdown{width:calc(100vw - 16px) !important;position:fixed !important;left:8px !important;right:8px !important;top:auto !important;transform:none !important}}" +
      ".notif-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;font-size:12px;font-weight:700;color:#555;border-bottom:1px solid #f0ece6}" +
      ".notif-mark-all{background:none;border:none;cursor:pointer;font-size:11px;color:#5b9bd5;font-family:inherit;font-weight:600;padding:0}" +
      ".notif-mark-all:hover{text-decoration:underline}" +
      ".notif-list-scroll{max-height:280px;overflow-y:auto}" +
      ".notif-item{display:block;padding:10px 16px;border-bottom:1px solid #f5f0eb;text-decoration:none !important;color:#333 !important;transition:background .15s;position:relative}" +
      ".notif-item:hover{background:#fdf9f5}" +
      ".notif-item.unread{background:#fef9f0}" +
      ".notif-item.unread:hover{background:#fdf3e0}" +
      ".notif-item-title{font-size:13px;font-weight:600;color:#333;line-height:1.35;margin-bottom:3px;padding-right:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".notif-item.unread .notif-item-title{color:#9a7b55}" +
      ".notif-item-date{font-size:11px;color:#888}" +
      ".notif-unread-dot{position:absolute;top:14px;right:14px;width:7px;height:7px;border-radius:50%;background:#9a7b55}" +
      ".notif-empty{padding:28px 16px;text-align:center;font-size:13px;color:#888}" +
      ".notif-empty i{font-size:1.6rem;display:block;margin-bottom:8px;color:#ccc}" +
      ".notif-loading{padding:20px 16px;text-align:center;font-size:12px;color:#888}" +
      ".notif-footer{padding:10px 16px;border-top:1px solid #f0ece6;text-align:center}" +
      ".notif-footer a{font-size:12px !important;color:#5b9bd5 !important;font-weight:600;text-decoration:none}" +
      ".notif-footer a:hover{text-decoration:underline}";
    document.head.appendChild(style);

    var badge = document.createElement("span");
    badge.className = "notif-badge";
    badge.id = "notifBadge";
    bellLink.appendChild(badge);

    var menu = wrapper.querySelector(".dropdown-menu");
    if (menu) {
      menu.className =
        "dropdown-menu dropdown-menu-end notif-dropdown rounded-0 rounded-bottom border-0 shadow-sm m-0";
      menu.innerHTML =
        '<div class="notif-header">' +
        "<span>Belum Dibaca</span>" +
        '<button class="notif-mark-all" id="notifMarkAll">Tandai semua dibaca</button>' +
        "</div>" +
        '<div id="notifList"><div class="notif-loading">Memuat...</div></div>' +
        '<div class="notif-footer">' +
        '<a href="' + prefix + 'pengumuman.html">Lihat semua pengumuman <i class="bi bi-arrow-right"></i></a>' +
        "</div>";
    }

    var markAllBtn = document.getElementById("notifMarkAll");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        markAllRead();
      });
    }

    loadNotifications(prefix);

    wrapper.addEventListener("shown.bs.dropdown", function () {
      var m = wrapper.querySelector(".dropdown-menu");
      if (!m) return;
      if (window.innerWidth <= 576) return;
      m.style.transform = "none";
      var rect = m.getBoundingClientRect();
      if (rect.left < 8) {
        m.style.left = "0";
        m.style.right = "auto";
      } else if (rect.right > window.innerWidth - 8) {
        m.style.left = "auto";
        m.style.right = "0";
      }
    });
  }

  // ── Auth helpers ──

  function getUserId() {
    try { return JSON.parse(localStorage.getItem("user") || "{}").id || null; }
    catch (e) { return null; }
  }

  function getToken() {
    return localStorage.getItem("access_token");
  }

  // ── localStorage cache (fast, per-device backup) ──

  function getLocalKey() {
    var uid = getUserId();
    return uid ? "notif_read_" + uid : null;
  }

  function getLocalReadIds() {
    var key = getLocalKey();
    if (!key) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]").map(String)); }
    catch (e) { return new Set(); }
  }

  function saveLocalReadIds(set) {
    var key = getLocalKey();
    if (key) localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  // ── Supabase DB sync ──

  function fetchReadFromDB() {
    var userId = getUserId();
    var token = getToken();
    if (!userId || !token) return Promise.resolve(null);

    return fetch(SUPABASE_URL + "/rest/v1/users?id=eq." + userId + "&select=read_articles", {
      headers: { "Authorization": "Bearer " + token, "apikey": SUPABASE_ANON }
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data[0]) return null;
        return new Set((data[0].read_articles || []).map(String));
      })
      .catch(function () { return null; });
  }

  function patchReadToDB(set) {
    var userId = getUserId();
    var token = getToken();
    if (!userId || !token) return;

    fetch(SUPABASE_URL + "/rest/v1/users?id=eq." + userId, {
      method: "PATCH",
      headers: {
        "Authorization": "Bearer " + token,
        "apikey": SUPABASE_ANON,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ read_articles: Array.from(set) })
    }).catch(function () {});
  }

  // ── Get read IDs: DB (source of truth) merged with localStorage cache ──

  function getReadIds() {
    if (_readCache !== null) return Promise.resolve(_readCache);

    return fetchReadFromDB().then(function (dbSet) {
      var localSet = getLocalReadIds();
      if (dbSet) {
        localSet.forEach(function (id) { dbSet.add(id); });
        _readCache = dbSet;
      } else {
        _readCache = localSet;
      }
      saveLocalReadIds(_readCache);
      return _readCache;
    });
  }

  // ── Mark read ──

  function markRead(articleId) {
    if (!getUserId()) return;
    if (!_readCache) _readCache = getLocalReadIds();
    if (_readCache.has(String(articleId))) return; // already read

    _readCache.add(String(articleId));
    saveLocalReadIds(_readCache);
    patchReadToDB(_readCache);

    var b = document.getElementById("notifBadge");
    if (b) {
      var cur = parseInt(b.textContent) || 0;
      var next = cur - 1;
      if (next <= 0) {
        b.style.display = "none";
      } else {
        b.textContent = next > 9 ? "9+" : String(next);
      }
    }

    var item = document.querySelector("#notifList .notif-item[data-id='" + articleId + "']");
    if (item) item.remove();
  }

  function markAllRead() {
    var els = document.querySelectorAll("#notifList .notif-item[data-id]");
    if (!_readCache) _readCache = getLocalReadIds();
    els.forEach(function (el) { _readCache.add(el.dataset.id); });
    saveLocalReadIds(_readCache);
    patchReadToDB(_readCache);

    var list = document.getElementById("notifList");
    if (list)
      list.innerHTML = '<div class="notif-empty"><i class="bi bi-check-circle"></i>Semua sudah dibaca.</div>';
    var b = document.getElementById("notifBadge");
    if (b) b.style.display = "none";
  }

  // ── Expose globally so artikel_form.html can call on page load ──
  window.notifMarkRead = markRead;

  // ── Fetch announcements with audience filter (server-side) ──

  function fetchAnnouncements() {
    var userId = getUserId();
    var token  = getToken();
    if (!userId || !token) return Promise.resolve([]);

    // Lookup user's category_id, lalu request announcements yang match
    return fetch(SUPABASE_URL + "/rest/v1/users?id=eq." + userId + "&select=category_id", {
      headers: { "Authorization": "Bearer " + token, "apikey": SUPABASE_ANON }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var catId = rows && rows[0] ? rows[0].category_id : null;
        var url = SUPABASE_URL + "/functions/v1/CRUD/articles?type=announcement";
        if (catId) {
          url += "&audience_category_id=" + encodeURIComponent(catId);
        }
        // admin/editor (no category_id) → tidak dilfilter, lihat semua pengumuman
        return fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + SUPABASE_ANON,
            "apikey": SUPABASE_ANON
          }
        });
      })
      .then(function (res) {
        if (!res || !res.ok) return [];
        return res.json();
      })
      .then(function (json) { return (json && json.data) || []; })
      .catch(function () { return []; });
  }

  // ── Load & render ──

  function loadNotifications(prefix) {
    if (!getUserId()) return;

    // Bell hanya menampilkan pengumuman (type=announcement). Filter audience
    // dilakukan client-side karena kita perlu inspect category_id user dulu.
    Promise.all([
      fetchAnnouncements(),
      getReadIds()
    ])
      .then(function (results) {
        var articles = results[0];
        var readIds = results[1];
        var unread = articles.filter(function (a) {
          return !readIds.has(String(a.id));
        });

        var b = document.getElementById("notifBadge");
        if (unread.length > 0) {
          b.textContent = unread.length > 9 ? "9+" : String(unread.length);
          b.style.display = "flex";
        } else {
          b.style.display = "none";
        }

        var list = document.getElementById("notifList");
        if (articles.length === 0) {
          list.innerHTML = '<div class="notif-empty"><i class="bi bi-journal-x"></i>Belum ada pengumuman.</div>';
          return;
        }
        if (unread.length === 0) {
          list.innerHTML = '<div class="notif-empty"><i class="bi bi-check-circle"></i>Semua sudah dibaca.</div>';
          return;
        }

        var display = unread.slice(0, 6);
        var html = '<div class="notif-list-scroll">';
        display.forEach(function (a) {
          var date = new Date(a.created_at).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
          });
          html +=
            '<a href="' + prefix + "artikel_form.html?id=" + a.id +
            '" class="notif-item unread" data-id="' + a.id + '">' +
            '<div class="notif-unread-dot"></div>' +
            '<div class="notif-item-title">' + escapeHtml(a.title) + "</div>" +
            '<div class="notif-item-date">' + date + "</div>" +
            "</a>";
        });
        html += "</div>";
        list.innerHTML = html;

        list.querySelectorAll(".notif-item[data-id]").forEach(function (el) {
          el.addEventListener("click", function () {
            markRead(el.dataset.id);
          });
        });
      })
      .catch(function (e) {
        var el = document.getElementById("notifList");
        if (el) el.innerHTML = '<div class="notif-loading">Gagal memuat.</div>';
        console.error("notif-bell:", e);
      });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
