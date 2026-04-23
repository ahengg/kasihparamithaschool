# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **static HTML website** for Kasih Paramitha School. No build system, package manager, or test runner — files are served directly as static HTML/CSS/JS.

To develop locally, open any `.html` file directly in a browser or use a simple static file server (e.g., VS Code Live Server, `python -m http.server`).

## Architecture

### Page Structure

All public pages follow the same structure:
- Wrapped in `<div class="container-xxl bg-white p-0">`
- Scripts at bottom: jQuery → Bootstrap bundle → WOW.js → `js/config.js` → `js/main.js` → `js/auth-navbar.js` → `js/notif-bell.js` → `js/lang.js` → page-specific inline `<script>`

**`js/config.js` must load before any page script** — it sets `window.__SUPABASE = { URL, ANON }` and `window.escapeHtml()`, which all other scripts depend on.

**Exception — `login/login.html`:** Navbar NOT wrapped in `container-xxl` (sits directly in `<body>`) for full width. Does NOT load `main.js` or `auth-navbar.js`.

**Exception — `home_user.html` and `admin/*.html`:** Do NOT load `main.js` or `wow.min.js` — these pages have no owlCarousel and `main.js` would crash trying to initialise it.

### Navbar Behavior (critical)

`js/main.js` sets `.sticky-top { top: -100px }` and reveals only after scrolling 300px. Pages with little content must override: `.navbar.sticky-top { top: 0 !important; transition: none !important; }` in their `<style>` block. **All admin pages and `home_user.html` need this override.**

### CSS Class Collisions (critical)

`css/style.css` has `.page-header::after` that injects a wave/background image. **Never use `.page-header` as a class name in custom pages** — use a namespaced variant like `.article-page-header`, `.manage-page-header`, etc.

### Auth & Role System

**Login flow** (`login/login.html`):
1. POST `/CRUD/auth/login` with `{ username, password }` — uses fake email `username@kasihparamitha.sch.id` internally
2. GET `/rest/v1/users?id=eq.${userId}&select=role_id,roles!role_id(role_name)` — fetch role via PostgREST FK join
3. Store in `localStorage`: `access_token`, `refresh_token`, `expires_at`, `user` (JSON), `username`, `role`
4. Redirect to `home_user.html`

**Roles**: `user`, `editor`, `admin` — stored in `localStorage.role`. Role controls UI visibility:
- `editor` + `admin`: see Add Article button, can upload/edit materials
- `admin` only: see Manage Users button, can delete materials

**Token pattern** used in all authenticated pages:
```javascript
function isTokenValid(token) { /* checks JWT format + exp > now+30s */ }
async function refreshAccessToken() { /* POST /CRUD/auth/refresh with SUPABASE_ANON as Authorization */ }
async function ensureValidToken() { /* returns valid token or calls logout() */ }
```
Refresh endpoint requires `Authorization: Bearer ${SUPABASE_ANON}` (not user JWT).

**Auth navbar** (`js/auth-navbar.js`): Included in all public pages. Hides `.login-btn` and injects Home + Logout buttons when `localStorage.access_token` exists.

### Supabase Edge Function (`/functions/v1/CRUD/`)

All routes go through one Edge Function (`supabase/functions/CRUD/index.ts`). The `Authorization` header must always be `Bearer ${SUPABASE_ANON}` for all Edge Function calls. User JWTs go in the custom `x-access-token` header to bypass Supabase gateway validation.

**Auth routes:**
- `POST /CRUD/auth/login` — public (anon key)
- `POST /CRUD/auth/register` — public (anon key)
- `POST /CRUD/auth/refresh` — public (anon key), body: `{ refresh_token }`
- `POST /CRUD/auth/logout` — requires `x-access-token`
- `GET /CRUD/auth/me` — requires `x-access-token`

**Article routes:**
- `GET /CRUD/articles` — public; `?type=article|announcement`; `?audience_category_id=public|<id>`
- `GET /CRUD/articles/:id` — public
- `POST /CRUD/articles` — requires `x-access-token`
- `PATCH /CRUD/articles/:id` — requires `x-access-token` (own articles only via RLS)
- `DELETE /CRUD/articles/:id` — requires `x-access-token`

**Article table required fields**: `title`, `content`, `slug` (generate from title + `Date.now()`), `status` (use `"published"`). `image_link` is optional — omit the key entirely if no image rather than sending `null`.

**Article type & audience** (migration 004):
- `type` — `'article'` (default, public, shows on `artikel.html`) or `'announcement'` (shows on `pengumuman.html`).
- `audience_category_id` — FK to `categories(id)`, **only used when `type='announcement'`**. `NULL` = public/all classes (visible without login). Non-null = only users whose `users.category_id` matches.
- The Edge Function `sanitizeArticleBody` whitelists fields and force-nulls `audience_category_id` when type is `article`.

**Materials routes:**
- `GET /CRUD/materials` — public; `?category_id=<id>` for filtering
- `POST /CRUD/materials` — requires `x-access-token` + editor/admin role; body: `{ title, file_url, file_name, description?, file_size?, category_id? }`
- `PATCH /CRUD/materials/:id` — requires `x-access-token` + editor/admin role; replaces old Storage file if `file_url` changes
- `DELETE /CRUD/materials/:id` — requires `x-access-token` + admin role; also removes file from Storage bucket

**Other routes:**
- `GET /CRUD/categories` — public; returns `[{ id, name }]`
- `GET /CRUD/users` — requires `x-access-token` + admin role
- `GET /CRUD/users/:id` — requires `x-access-token`
- `DELETE /CRUD/users/:id` — requires `x-access-token`; admin can delete anyone, others can only delete themselves
- `POST /CRUD/cleanup` — internal cron only; auth via `x-cleanup-secret` header

**Supabase REST API** (used for users/roles, bypasses Edge Function):
- `GET /rest/v1/users?select=*,roles!role_id(role_name)` — join syntax for FK
- `PATCH /rest/v1/users?id=eq.${id}` — update user fields (includes `read_articles` array for notification tracking)
- Uses `Authorization: Bearer ${userToken}` + `apikey: ${SUPABASE_ANON}`

### Users Table Fields

Key fields beyond standard auth: `role_id` (FK → `roles`), `category_id` (FK → `categories`, determines which announcements a student sees), `read_articles` (array of article UUIDs, synced cross-device by `notif-bell.js`).

### Materials System

`materi.html` (public page) lists downloadable school materials. Files are stored in the Supabase **`materials` Storage bucket** (public bucket — files accessible via public URL).

- Materials have an optional `category_id` (FK → `categories`) for filtering by class.
- `admin/upload_materi.html` handles upload: file goes to Storage first (via direct `fetch` to Storage API), then `POST /CRUD/materials` records the metadata.
- When deleting or replacing a material file, the Edge Function removes the old file from Storage.

### Admin Section (`/admin/`)

| File | Purpose |
|------|---------|
| `add_article.html` | Create article OR pengumuman — editor/admin only; type dropdown reveals audience (public/categories) when type=announcement |
| `edit_article.html` | Edit/delete article — editor/admin only, pre-fills type & audience from `?id=` param |
| `manage_users.html` | CRUD users — admin only; edit modal shows only role dropdown; current user row shows no action buttons |
| `upload_materi.html` | Upload/manage school materials — editor/admin upload, admin-only delete |
| `add_user.html` | **Legacy** standalone add user (superseded by `manage_users.html`) |
| `artikelAdmin.html` | **Legacy** article list for admin (superseded by `add_article.html`/`edit_article.html`) |
| `edit-artikel.html` | **Legacy** edit article (superseded by `edit_article.html`) |

Admin pages use `../` relative paths for all assets.

### Cleanup Cron (migration 005)

A daily cron (00:00 WIB / 17:00 UTC) calls `POST /CRUD/cleanup` via `pg_net` from `pg_cron`. The Edge Function deletes:
- `articles WHERE type='announcement'` AND age ≥ 5 business days (Mon–Fri, weekends skipped)
- `materials` AND age ≥ 5 business days — also removes the file from the `materials` Storage bucket.

Auth is via `x-cleanup-secret` header matching `CLEANUP_SECRET` env on the Edge Function. Required Postgres GUCs: `app.supabase_url`, `app.supabase_anon`, `app.cleanup_secret`. See `005_cleanup_cron.sql` header for one-time setup steps (must enable `pg_cron` + `pg_net` extensions).

### Navbar conditional links

`js/notif-bell.js` (loaded on every page) hides any `a[href*="kalenderakademik.html"]` unless `localStorage.role === "user"`. Don't duplicate this guard in page-level scripts.

`js/lang.js` injects two EN/ID toggle pills: a mobile pill (`d-lg-none`, before the navbar-toggler — always visible) and a desktop pill (`d-none d-lg-inline-flex`, inside `#navbarCollapse`). Both update together when clicked. To make a text element translatable, add `data-en="..."` and `data-id="..."` attributes — `lang.js` applies them automatically.

### Notification Bell (`js/notif-bell.js`)

Shows unread announcements for logged-in users. Read state is synced to `users.read_articles` in Supabase (source of truth) and cached in `localStorage` as `notif_read_<userId>`. Audience filtering: fetches user's `category_id` first, then requests announcements with matching `audience_category_id`. Exposes `window.notifMarkRead(articleId)` for `artikel_form.html` to call on page load.

### Default Article Image

When `image_link` is null/empty, all article display pages fall back to `assetkps/Home/JAV_9935.jpg`. Use `onerror="this.src='assetkps/Home/JAV_9935.jpg'"` on `<img>` tags for broken URL fallback.

### CSS / Styling

| File | Purpose |
|------|---------|
| `css/bootstrap.min.css` | Customised Bootstrap 5 |
| `css/style.css` | Main template styles; `--primary` (#5b9bd5), `--light` (#fcc203), `--dark`/`--text-color` (#8b7355) |
| `css/fonts.css` | `@font-face` — **must load after `style.css`** |

Each page has its own `<style>` block for overrides. The `.login-btn` brown pill and `.logout-btn` border-only styles are defined per-page.

Bootstrap Icons 1.4.1 is used — not all icons from later versions exist. Use `bi-trash-fill` not `bi-trash3-fill`, etc.

### Path Conventions

| Location | Prefix |
|----------|--------|
| Root pages | `assetkps/…`, `css/…`, `js/…` |
| `login/login.html` | `../assetkps/…`, `../css/…`, `../js/…` |
| `admin/*.html` | `../assetkps/…`, `../css/…`, `../js/…` |
