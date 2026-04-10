/**
 * Notification Bell — shows unread articles in the navbar bell dropdown.
 * Hides the bell entirely when the user is not logged in.
 * Tracks read articles per-user in localStorage.
 */
(function () {
  var SUPABASE_URL = window.__SUPABASE.URL;
  var SUPABASE_ANON = window.__SUPABASE.ANON;

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

    // Detect sub-directory for link prefixes
    var loc = window.location.pathname.toLowerCase();
    var isSubDir = loc.indexOf("/admin/") !== -1 || loc.indexOf("/login/") !== -1;
    var prefix = isSubDir ? "../" : "";

    // Inject CSS
    var style = document.createElement("style");
    style.textContent =
      ".notif-link{position:relative}" +
      ".notif-badge{display:none;position:absolute;top:2px;right:-4px;background:#e53935;color:#fff !important;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px;line-height:1;pointer-events:none}" +
      ".notif-dropdown{width:320px;padding:0;min-width:0}" +
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

    // Add badge to bell link
    var badge = document.createElement("span");
    badge.className = "notif-badge";
    badge.id = "notifBadge";
    bellLink.appendChild(badge);

    // Replace dropdown menu content
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
        '<a href="' +
        prefix +
        'artikel.html">Lihat semua artikel <i class="bi bi-arrow-right"></i></a>' +
        "</div>";
    }

    // Mark All button
    var markAllBtn = document.getElementById("notifMarkAll");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        markAllRead();
      });
    }

    loadNotifications(prefix);
  }

  // ── Helpers ──

  function getUserId() {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").id || null;
    } catch (e) {
      return null;
    }
  }

  function getStorageKey() {
    var uid = getUserId();
    return uid ? "notif_read_" + uid : null;
  }

  function getReadIds() {
    var key = getStorageKey();
    if (!key) return new Set();
    try {
      return new Set(
        JSON.parse(localStorage.getItem(key) || "[]").map(String)
      );
    } catch (e) {
      return new Set();
    }
  }

  function saveReadIds(readSet) {
    var key = getStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(Array.from(readSet)));
  }

  // ── Load & render ──

  function loadNotifications(prefix) {
    if (!getUserId()) return;

    fetch(SUPABASE_URL + "/functions/v1/CRUD/articles", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + SUPABASE_ANON,
        apikey: SUPABASE_ANON,
      },
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var articles = json.data || [];
        var readIds = getReadIds();
        var unread = articles.filter(function (a) {
          return !readIds.has(String(a.id));
        });

        // Badge
        var b = document.getElementById("notifBadge");
        if (unread.length > 0) {
          b.textContent = unread.length > 9 ? "9+" : String(unread.length);
          b.style.display = "flex";
        } else {
          b.style.display = "none";
        }

        // List
        var list = document.getElementById("notifList");
        if (articles.length === 0) {
          list.innerHTML =
            '<div class="notif-empty"><i class="bi bi-journal-x"></i>Belum ada artikel.</div>';
          return;
        }
        if (unread.length === 0) {
          list.innerHTML =
            '<div class="notif-empty"><i class="bi bi-check-circle"></i>Semua sudah dibaca.</div>';
          return;
        }

        var display = unread.slice(0, 6);
        var html = '<div class="notif-list-scroll">';
        display.forEach(function (a) {
          var date = new Date(a.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          html +=
            '<a href="' +
            prefix +
            "artikel_form.html?id=" +
            a.id +
            '" class="notif-item unread" data-id="' +
            a.id +
            '">' +
            '<div class="notif-unread-dot"></div>' +
            '<div class="notif-item-title">' +
            escapeHtml(a.title) +
            "</div>" +
            '<div class="notif-item-date">' +
            date +
            "</div>" +
            "</a>";
        });
        html += "</div>";
        list.innerHTML = html;

        // Attach mark-read handlers
        list.querySelectorAll(".notif-item[data-id]").forEach(function (el) {
          el.addEventListener("click", function () {
            markRead(el.dataset.id);
          });
        });
      })
      .catch(function (e) {
        var el = document.getElementById("notifList");
        if (el)
          el.innerHTML =
            '<div class="notif-loading">Gagal memuat.</div>';
        console.error("notif-bell:", e);
      });
  }

  function markRead(articleId) {
    var readIds = getReadIds();
    readIds.add(String(articleId));
    saveReadIds(readIds);

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
  }

  function markAllRead() {
    var els = document.querySelectorAll("#notifList .notif-item[data-id]");
    var readIds = getReadIds();
    els.forEach(function (el) {
      readIds.add(el.dataset.id);
    });
    saveReadIds(readIds);
    var list = document.getElementById("notifList");
    if (list)
      list.innerHTML =
        '<div class="notif-empty"><i class="bi bi-check-circle"></i>Semua sudah dibaca.</div>';
    var b = document.getElementById("notifBadge");
    if (b) b.style.display = "none";
  }

  // ── Bootstrap ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
