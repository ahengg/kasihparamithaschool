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

async function getArticles(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase
    .from("articles").select("*").order("created_at", { ascending: false });
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(200, { data });
}

async function getArticleById(supabase: SupabaseClient, id: string): Promise<Response> {
  const { data, error } = await supabase
    .from("articles").select("*").eq("id", id).maybeSingle();
  if (error) return jsonResponse(400, { error: error.message });
  if (!data) return jsonResponse(404, { error: "Artikel tidak ditemukan" });
  return jsonResponse(200, { data });
}

async function createArticle(supabase: SupabaseClient, user: User, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  const { data, error } = await supabase
    .from("articles").insert({ ...body, user_id: user.id }).select("*").single();
  if (error) return jsonResponse(400, { error: error.message });
  return jsonResponse(201, { data });
}

async function updateArticle(supabase: SupabaseClient, id: string, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Json | null;
  if (!body) return jsonResponse(400, { error: "Invalid JSON" });
  delete (body as Json).user_id;
  const { data, error } = await supabase
    .from("articles").update(body).eq("id", id).select("*").maybeSingle();
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

async function deleteUser(supabase: SupabaseClient, user: User, id: string): Promise<Response> {
  if (user.id !== id) return jsonResponse(403, { error: "Tidak diizinkan" });
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return jsonResponse(400, { error: error.message });
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
      if (req.method === "GET"    && segments.length === 1) return await getArticles(supabase);
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
          "GET    /CRUD/articles",
          "GET    /CRUD/articles/:id",
          "POST   /CRUD/articles",
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
        ],
      });
    }

    return jsonResponse(404, { error: "Route tidak ditemukan" });

  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message ?? "Server error" });
  }
});
