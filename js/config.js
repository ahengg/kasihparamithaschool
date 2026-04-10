/**
 * Centralized Supabase configuration + shared security utilities.
 *
 * NOTE: The anon key below is a PUBLIC key by design — Supabase's security
 * model relies on Row Level Security (RLS) and JWT validation, NOT on keeping
 * this key secret. The SERVICE_ROLE_KEY stays server-side in the Edge Function.
 *
 * Include this script BEFORE any page-specific scripts:
 *   <script src="js/config.js"></script>        (root pages)
 *   <script src="../js/config.js"></script>      (admin/ and login/ pages)
 */
(function () {
  window.__SUPABASE = {
    URL: "https://bzmakzdyqpkjmgpbabke.supabase.co",
    ANON: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bWFremR5cXBram1ncGJhYmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDgwNjMsImV4cCI6MjA5MDU4NDA2M30.jdgIu7WU0RZ_mxZUSZp-wrXI4vQtxNnZs3ehPXa2V3w",
  };

  /**
   * Escape HTML entities to prevent XSS when inserting user-controlled
   * data into innerHTML / template literals.
   *
   * Usage: escapeHtml(userString)
   */
  window.escapeHtml = function (str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
})();
