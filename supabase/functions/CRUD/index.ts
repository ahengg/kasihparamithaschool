// supabase/functions/CRUD/index.ts
import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2.45.4";

// ============================================================
// TYPES
// ============================================================

type Json = Record<string, unknown>;

// ============================================================
// CONFIG
// ============================================================

// Domain palsu untuk convert username → email
const EMAIL_DOMAIN = "kasihparamitha.sch.id";

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
}

// ============================================================
// CORS & RESPONSE HELPERS
// ============================================================
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  };


function jsonResponse(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function unauthorized(message = "Unauthorized"): Response {
  return jsonResponse(401, { error: message });
}

// ============================================================
// SUPABASE CLIENT & AUTH
// ============================================================

function buildClient(token: string | null): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    }
  );
}

// Service-role client: bypass RLS — dipakai untuk role-check & materials write
function buildServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

  function extractToken(req: Request): string | null {
    const custom = req.headers.get("x-access-token");
    if (custom) return custom;
    const authHeader = req.headers.get("authorization") ?? "";
    return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  }
async function requireAuthed(
    supabase: SupabaseClient,
    token: string | null
  ): Promise<User | null> {
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  }

// Ambil role_name user dari tabel users → roles (FK join)
async function getUserRole(userId: string): Promise<string | null> {
  const service = buildServiceClient();
  const { data, error } = await service
    .from("users")
    .select("role_id, roles!role_id(role_name)")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return (data as unknown as { roles: { role_name: string } }).roles?.role_name ?? null;
}

// ============================================================
// AUTH HANDLERS
// ============================================================

// POST /auth/register — body: { username, password, ...metadata }
// username akan dikonversi ke username@kasihparamitha.sch.id
async function register(supabase: SupabaseClient, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });

  const username = body.username as string | undefined;
  const password = body.password as string | undefined;

  if (!username) return jsonResponse(400, { error: "username wajib diisi" });
  if (!password) return jsonResponse(400, { error: "password wajib diisi" });

  // Validasi username: hanya huruf, angka, underscore, titik
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return jsonResponse(400, { error: "Username hanya boleh huruf, angka, titik, dan underscore" });
  }

  const email = usernameToEmail(username);

  // Metadata yang disimpan di Supabase Auth
  const { username: _u, password: _p, ...metadata } = body;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, ...metadata },
    },
  });

  if (error) return jsonResponse(400, { error: error.message });

  return jsonResponse(201, {
    message: "Registrasi berhasil.",
    user: data.user as unknown as Json,
    session: data.session as unknown as Json,
  });
}

// POST /auth/login — body: { username, password }
async function login(supabase: SupabaseClient, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });

  const username = body.username as string | undefined;
  const password = body.password as string | undefined;

  if (!username) return jsonResponse(400, { error: "username wajib diisi" });
  if (!password) return jsonResponse(400, { error: "password wajib diisi" });

  // Convert username → email palsu
  const email = usernameToEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Pesan error lebih ramah
    if (error.message.includes("Invalid login credentials")) {
      return jsonResponse(401, { error: "Username atau password salah" });
    }
    return jsonResponse(401, { error: error.message });
  }

  return jsonResponse(200, {
    message: "Login berhasil",
    user: data.user as unknown as Json,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}

// POST /auth/logout — requires Bearer token
async function logout(supabase: SupabaseClient, token: string | null): Promise<Response> {
  if (!token) return unauthorized("Login required");
  const { error } = await supabase.auth.signOut();
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { message: "Logout berhasil" });
}

// GET /auth/me — returns current user from Bearer token
async function getMe(supabase: SupabaseClient, token: string | null): Promise<Response> {
  if (!token) return unauthorized("Login required");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return unauthorized("Token tidak valid atau sudah expired");
  return jsonResponse(200, { user: data.user as unknown as Json });
}

// POST /auth/refresh — body: { refresh_token }
async function refreshToken(supabase: SupabaseClient, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });

  const refresh_token = body.refresh_token as string | undefined;
  if (!refresh_token) return jsonResponse(400, { error: "refresh_token wajib diisi" });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return jsonResponse(401, { error: error.message });

  return jsonResponse(200, {
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    expires_at: data.session?.expires_at,
  });
}

// ============================================================
// ARTICLES HANDLERS
// ============================================================

// GET /articles — opsional ?type=article|announcement & ?audience_category_id=
// audience_category_id="public" → hanya yang NULL
// audience_category_id="<id>"   → NULL ATAU match category id (untuk user kelas)
async function getArticles(supabase: SupabaseClient, url: URL): Promise<Response> {
  const type     = url.searchParams.get("type");
  const audience = url.searchParams.get("audience_category_id");

  let query = supabase
    .from("articles")
    .select("*, categories!audience_category_id(id, name)")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);

  if (audience === "public") {
    query = query.is("audience_category_id", null);
  } else if (audience) {
    const cid = Number(audience);
    if (Number.isFinite(cid)) {
      // Match user's category OR public (NULL audience)
      query = query.or(`audience_category_id.eq.${cid},audience_category_id.is.null`);
    }
  }

  const { data, error } = await query;
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { data });
}

async function getArticleById(supabase: SupabaseClient, id: string): Promise<Response> {
  const { data, error } = await supabase
    .from("articles")
    .select("*, categories!audience_category_id(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "Artikel tidak ditemukan" });
  return jsonResponse(200, { data });
}

// Whitelist field yang boleh di-set untuk articles
function sanitizeArticleBody(body: Json): Json {
  const allowed = ["title", "content", "slug", "status", "image_link", "type", "audience_category_id"];
  const out: Json = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  // Validate type
  if (out.type !== undefined && out.type !== "article" && out.type !== "announcement") {
    out.type = "article";
  }
  // audience hanya bermakna untuk announcement; paksa null untuk article
  if (out.type === "article") {
    out.audience_category_id = null;
  } else if (out.audience_category_id !== undefined && out.audience_category_id !== null) {
    out.audience_category_id = Number(out.audience_category_id);
  }
  return out;
}

async function createArticle(supabase: SupabaseClient, user: User, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  const payload = sanitizeArticleBody(body);
  const { data, error } = await supabase
    .from("articles").insert({ ...payload, user_id: user.id }).select("*").single();
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(201, { data });
}

async function updateArticle(supabase: SupabaseClient, id: string, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  const payload = sanitizeArticleBody(body);
  const { data, error } = await supabase
    .from("articles").update(payload).eq("id", id).select("*").maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "Artikel tidak ditemukan atau tidak diizinkan" });
  return jsonResponse(200, { data });
}

async function deleteArticle(supabase: SupabaseClient, id: string): Promise<Response> {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { ok: true });
}

// ============================================================
// USERS HANDLERS
// ============================================================

async function getUsers(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase
    .from("users").select("*").order("created_at", { ascending: false });
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { data });
}

async function getUserById(supabase: SupabaseClient, id: string): Promise<Response> {
  const { data, error } = await supabase
    .from("users").select("*").eq("id", id).maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "User tidak ditemukan" });
  return jsonResponse(200, { data });
}

async function createUser(supabase: SupabaseClient, user: User, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  const { data, error } = await supabase
    .from("users").insert({ ...body, id: user.id }).select("*").single();
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(201, { data });
}

async function updateUser(supabase: SupabaseClient, user: User, id: string, req: Request): Promise<Response> {
  if (user.id !== id) return jsonResponse(403, { error: "Tidak diizinkan" });
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  delete (body as Json).id;
  const { data, error } = await supabase
    .from("users").update(body).eq("id", id).select("*").maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "User tidak ditemukan atau tidak diizinkan" });
  return jsonResponse(200, { data });
}

async function deleteUser(_supabase: SupabaseClient, user: User, id: string): Promise<Response> {
  // Admin boleh hapus user lain. Selain admin hanya boleh hapus dirinya sendiri.
  const role = await getUserRole(user.id);
  if (role !== "admin" && user.id !== id) {
    return jsonResponse(403, { error: "Tidak diizinkan" });
  }

  // Hapus dari auth.users (service role) — sekaligus invalidasi semua sesi/refresh token.
  // public.users biasanya cascade, tapi delete eksplisit sebagai jaring pengaman.
  const service = buildServiceClient();
  const { error: authErr } = await service.auth.admin.deleteUser(id);
  if (authErr && !/not.?found/i.test(authErr.message)) {
    return jsonResponse(400, { error: authErr.message });
  }

  await service.from("users").delete().eq("id", id);
  return jsonResponse(200, { ok: true });
}

// ============================================================
// MATERIALS HANDLERS
// ============================================================

// GET /materials — public, opsional ?category_id=
async function getMaterials(supabase: SupabaseClient, url: URL): Promise<Response> {
  const categoryId = url.searchParams.get("category_id");

  let query = supabase
    .from("materials")
    .select("id, title, description, file_url, file_name, file_size, created_at, category_id, categories!category_id(id, name)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (categoryId) query = query.eq("category_id", Number(categoryId));

  const { data, error } = await query;
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { data });
}

// POST /materials — admin + editor
async function createMaterial(user: User, req: Request): Promise<Response> {
  const role = await getUserRole(user.id);
  if (role !== "admin" && role !== "editor") {
    return jsonResponse(403, { error: "Hanya admin atau editor yang dapat mengupload materi" });
  }

  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });

  const { title, file_url, file_name } = body;
  if (!title)    return jsonResponse(400, { error: "title wajib diisi" });
  if (!file_url) return jsonResponse(400, { error: "file_url wajib diisi" });
  if (!file_name) return jsonResponse(400, { error: "file_name wajib diisi" });

  const service = buildServiceClient();
  const payload: Json = {
    title,
    file_url,
    file_name,
    status: "published",
  };
  if (body.description) payload.description  = body.description;
  if (body.file_size)   payload.file_size    = body.file_size;
  if (body.category_id) payload.category_id  = Number(body.category_id);

  const { data, error } = await service
    .from("materials")
    .insert(payload)
    .select()
    .single();
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(201, { data });
}

// PATCH /materials/:id — admin + editor
async function updateMaterial(user: User, id: string, req: Request): Promise<Response> {
  const role = await getUserRole(user.id);
  if (role !== "admin" && role !== "editor") {
    return jsonResponse(403, { error: "Tidak diizinkan" });
  }

  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });

  const service = buildServiceClient();

  // If a new file is being set, delete the old one from storage (best-effort)
  if (body.file_url) {
    const { data: existing } = await service
      .from("materials").select("file_url").eq("id", id).maybeSingle();
    const oldUrl = (existing as { file_url?: string } | null)?.file_url;
    if (oldUrl && oldUrl !== body.file_url) {
      const marker = "/storage/v1/object/public/materials/";
      const idx = oldUrl.indexOf(marker);
      if (idx !== -1) {
        const filePath = oldUrl.slice(idx + marker.length);
        await service.storage.from("materials").remove([filePath]);
      }
    }
  }

  const payload: Json = {};
  if (body.title       !== undefined) payload.title       = body.title;
  if (body.description !== undefined) payload.description = body.description ?? null;
  if (body.category_id !== undefined) payload.category_id = body.category_id ? Number(body.category_id) : null;
  if (body.file_url    !== undefined) payload.file_url    = body.file_url;
  if (body.file_name   !== undefined) payload.file_name   = body.file_name;
  if (body.file_size   !== undefined) payload.file_size   = body.file_size;

  const { data, error } = await service
    .from("materials")
    .update(payload)
    .eq("id", id)
    .select("id, title, description, file_url, file_name, file_size, created_at, category_id, categories!category_id(id, name)")
    .maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "Materi tidak ditemukan" });
  return jsonResponse(200, { data });
}

// DELETE /materials/:id — admin only, juga hapus file dari storage
async function deleteMaterial(user: User, id: string): Promise<Response> {
  const role = await getUserRole(user.id);
  if (role !== "admin") {
    return jsonResponse(403, { error: "Hanya admin yang dapat menghapus materi" });
  }

  const service = buildServiceClient();

  // Ambil file_url sebelum dihapus agar bisa hapus dari storage juga
  const { data: mat } = await service
    .from("materials")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await service.from("materials").delete().eq("id", id);
  if (error) return jsonResponse(400, { error: error.message });

  // Hapus file dari storage (best-effort, tidak gagalkan response jika error)
  if (mat?.file_url) {
    const marker = "/storage/v1/object/public/materials/";
    const idx = (mat.file_url as string).indexOf(marker);
    if (idx !== -1) {
      const filePath = (mat.file_url as string).slice(idx + marker.length);
      await service.storage.from("materials").remove([filePath]);
    }
  }

  return jsonResponse(200, { ok: true });
}

// ============================================================
// CATEGORIES HANDLERS
// ============================================================

// GET /categories — public
async function getCategories(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("id", { ascending: true });
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { data });
}

// ============================================================
// CLEANUP HANDLER (called by pg_cron via /CRUD/cleanup)
// ============================================================
//
// Hapus pengumuman & materi yang sudah > 5 hari kerja (Senin–Jumat).
// Materi: hapus row + file di Storage bucket 'materials'.
// Pengumuman: hapus row articles WHERE type='announcement'.
//
// Akses: butuh header `x-cleanup-secret` yang cocok dengan env CLEANUP_SECRET.
async function runCleanup(req: Request): Promise<Response> {
  const expected = Deno.env.get("CLEANUP_SECRET") ?? "";
  const provided = req.headers.get("x-cleanup-secret") ?? "";
  if (!expected || provided !== expected) {
    return unauthorized("Invalid cleanup secret");
  }

  const service = buildServiceClient();
  const result: Json = { announcements_deleted: 0, materials_deleted: 0, files_deleted: 0, errors: [] };

  // ── Pengumuman ──
  // Cari pengumuman yang business-day usianya >= 5
  const { data: anns, error: annErr } = await service
    .from("articles")
    .select("id, created_at")
    .eq("type", "announcement");
  if (annErr) {
    (result.errors as unknown[]).push({ stage: "select announcements", error: annErr.message });
  } else if (anns && anns.length > 0) {
    const expired = anns.filter((a) => businessDaysSince((a as { created_at: string }).created_at) >= 5);
    if (expired.length > 0) {
      const ids = expired.map((a) => (a as { id: string }).id);
      const { error: delErr } = await service.from("articles").delete().in("id", ids);
      if (delErr) {
        (result.errors as unknown[]).push({ stage: "delete announcements", error: delErr.message });
      } else {
        result.announcements_deleted = ids.length;
      }
    }
  }

  // ── Materi ──
  const { data: mats, error: matErr } = await service
    .from("materials")
    .select("id, created_at, file_url");
  if (matErr) {
    (result.errors as unknown[]).push({ stage: "select materials", error: matErr.message });
  } else if (mats && mats.length > 0) {
    const expired = mats.filter((m) => businessDaysSince((m as { created_at: string }).created_at) >= 5);
    if (expired.length > 0) {
      // 1. Hapus file dari storage (best-effort)
      const marker = "/storage/v1/object/public/materials/";
      const filePaths: string[] = [];
      for (const m of expired) {
        const url = (m as { file_url?: string }).file_url ?? "";
        const idx = url.indexOf(marker);
        if (idx !== -1) filePaths.push(url.slice(idx + marker.length));
      }
      if (filePaths.length > 0) {
        const { data: removed, error: stErr } = await service.storage.from("materials").remove(filePaths);
        if (stErr) {
          (result.errors as unknown[]).push({ stage: "delete storage files", error: stErr.message });
        } else {
          result.files_deleted = removed?.length ?? 0;
        }
      }

      // 2. Hapus row materi
      const ids = expired.map((m) => (m as { id: string }).id);
      const { error: rowErr } = await service.from("materials").delete().in("id", ids);
      if (rowErr) {
        (result.errors as unknown[]).push({ stage: "delete materials rows", error: rowErr.message });
      } else {
        result.materials_deleted = ids.length;
      }
    }
  }

  return jsonResponse(200, result);
}

// Hitung jumlah hari kerja (Senin–Jumat) yang sudah lewat sejak `since`
// menggunakan zona waktu Asia/Jakarta. Hari mulai tidak dihitung.
function businessDaysSince(since: string): number {
  const start = new Date(since);
  const now   = new Date();
  if (Number.isNaN(start.getTime()) || now <= start) return 0;

  // Convert ke WIB date string lalu loop hari demi hari
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const startStr = fmt.format(start);
  const endStr   = fmt.format(now);
  const startDate = new Date(startStr + "T00:00:00Z");
  const endDate   = new Date(endStr   + "T00:00:00Z");

  let cnt = 0;
  const cur = new Date(startDate);
  cur.setUTCDate(cur.getUTCDate() + 1); // hari mulai tidak dihitung
  while (cur <= endDate) {
    const dow = cur.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) cnt++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return cnt;
}

// ============================================================
// MAIN ROUTER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean).slice(1);

  const resource = segments[0];
  const token    = extractToken(req);
  const supabase = buildClient(token);

  try {

    // ── AUTH ROUTES ──────────────────────────────────────────
    if (resource === "auth") {
      const action = segments[1];
      if (req.method === "POST" && action === "register") return await register(supabase, req);
      if (req.method === "POST" && action === "login")    return await login(supabase, req);
      if (req.method === "POST" && action === "logout")   return await logout(supabase, token);
      if (req.method === "POST" && action === "refresh")  return await refreshToken(supabase, req);
      if (req.method === "GET"  && action === "me")       return await getMe(supabase, token);
      return jsonResponse(404, { error: "Auth route tidak ditemukan" });
    }

    // ── ARTICLES ROUTES ──────────────────────────────────────
    if (resource === "articles") {
      if (req.method === "GET"    && segments.length === 1) return await getArticles(supabase, url);
      if (req.method === "GET"    && segments.length === 2) return await getArticleById(supabase, segments[1]);
      if (req.method === "POST"   && segments.length === 1) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await createArticle(supabase, user, req);
      }
      if (req.method === "PATCH"  && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await updateArticle(supabase, segments[1], req);
      }
      if (req.method === "DELETE" && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await deleteArticle(supabase, segments[1]);
      }
    }

    // ── USERS ROUTES ─────────────────────────────────────────
    if (resource === "users") {
      if (req.method === "GET"    && segments.length === 1) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await getUsers(supabase);
      }
      if (req.method === "GET"    && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await getUserById(supabase, segments[1]);
      }
      if (req.method === "POST"   && segments.length === 1) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await createUser(supabase, user, req);
      }
      if (req.method === "PATCH"  && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await updateUser(supabase, user, segments[1], req);
      }
      if (req.method === "DELETE" && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await deleteUser(supabase, user, segments[1]);
      }
    }

    // ── MATERIALS ROUTES ─────────────────────────────────────
    if (resource === "materials") {
      // GET /materials — public, opsional ?category_id=
      if (req.method === "GET" && segments.length === 1) {
        return await getMaterials(supabase, url);
      }
      // POST /materials — admin + editor
      if (req.method === "POST" && segments.length === 1) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await createMaterial(user, req);
      }
      // PATCH /materials/:id — admin + editor
      if (req.method === "PATCH" && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await updateMaterial(user, segments[1], req);
      }
      // DELETE /materials/:id — admin only
      if (req.method === "DELETE" && segments.length === 2) {
        const user = await requireAuthed(supabase, token);
        if (!user) return unauthorized("Login diperlukan");
        return await deleteMaterial(user, segments[1]);
      }
    }

    // ── CATEGORIES ROUTES ─────────────────────────────────────
    if (resource === "categories") {
      // GET /categories — public
      if (req.method === "GET" && segments.length === 1) {
        return await getCategories(supabase);
      }
    }

    // ── CLEANUP ROUTE (cron-only) ─────────────────────────────
    if (resource === "cleanup") {
      if (req.method === "POST" && segments.length === 1) {
        return await runCleanup(req);
      }
    }

    // ── ROOT ─────────────────────────────────────────────────
    if (!resource) {
      return jsonResponse(200, {
        message: "CRUD API is running",
        routes: [
          "POST   /CRUD/auth/register  — { username, password }",
          "POST   /CRUD/auth/login     — { username, password }",
          "POST   /CRUD/auth/logout",
          "POST   /CRUD/auth/refresh   — { refresh_token }",
          "GET    /CRUD/auth/me",
          "GET    /CRUD/articles               — ?type=article|announcement, ?audience_category_id=public|<id>",
          "GET    /CRUD/articles/:id",
          "POST   /CRUD/articles               — { title, content, slug, type?, audience_category_id?, image_link? }",
          "PATCH  /CRUD/articles/:id",
          "DELETE /CRUD/articles/:id",
          "GET    /CRUD/users",
          "GET    /CRUD/users/:id",
          "POST   /CRUD/users",
          "PATCH  /CRUD/users/:id",
          "DELETE /CRUD/users/:id",
          "GET    /CRUD/materials               — ?category_id= (opsional)",
          "POST   /CRUD/materials",
          "DELETE /CRUD/materials/:id",
          "GET    /CRUD/categories",
          "POST   /CRUD/cleanup                — cron-only, header x-cleanup-secret",
        ],
      });
    }

    return jsonResponse(404, { error: "Route tidak ditemukan" });

  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message ?? "Server error" });
  }
});
