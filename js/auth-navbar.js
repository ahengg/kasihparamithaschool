(function () {
  const token    = localStorage.getItem("access_token");
  const username = localStorage.getItem("username");
  const role     = localStorage.getItem("role") || "";

  if (!token || !username) return; // belum login — tampilkan login btn seperti biasa

  // Sembunyikan tombol Login
  document.querySelectorAll(".login-btn").forEach(el => { el.style.display = "none"; });

  // Tentukan href home berdasarkan role
  const homeHref = (role === "admin" || role === "editor") ? "home_user.html" : "home_user.html";

  // Buat grup: tombol Home + Logout
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;";

  wrap.innerHTML = `
    <a href="${homeHref}" style="
      font-size:12px;font-weight:600;color:#9a7b55;text-decoration:none;
      padding:5px 12px;border-radius:6px;border:1.5px solid #9a7b55;
      display:inline-flex;align-items:center;gap:5px;transition:0.2s;"
      onmouseover="this.style.background='#9a7b55';this.style.color='#fff';"
      onmouseout="this.style.background='';this.style.color='#9a7b55';">
      <i class="bi bi-house-fill"></i> Home
    </a>
    <button onclick="(function(){
      ['access_token','refresh_token','expires_at','user','username','role']
        .forEach(function(k){ localStorage.removeItem(k); });
      window.location.href='login/login.html';
    })()" style="
      background:transparent;border:1.5px solid #9a7b55;color:#9a7b55;
      padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;
      cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:0.2s;
      font-family:inherit;"
      onmouseover="this.style.background='#9a7b55';this.style.color='#fff';"
      onmouseout="this.style.background='';this.style.color='#9a7b55';">
      <i class="bi bi-box-arrow-right"></i> Logout
    </button>
  `;

  // Sisipkan setelah login-btn (atau di akhir navbarCollapse)
  const loginBtns = document.querySelectorAll(".login-btn");
  if (loginBtns.length > 0) {
    loginBtns[0].parentNode.insertBefore(wrap, loginBtns[0].nextSibling);
  } else {
    const nav = document.getElementById("navbarCollapse");
    if (nav) nav.appendChild(wrap);
  }
})();
