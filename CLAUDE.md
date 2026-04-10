# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **static HTML website** for Kasih Paramitha School. No build system, package manager, or test runner — files are served directly as static HTML/CSS/JS.

To develop locally, open any `.html` file directly in a browser or use a simple static file server (e.g., VS Code Live Server, `python -m http.server`).

## Architecture

### Page Structure

All public pages follow the same structure:
- Wrapped in `<div class="container-xxl bg-white p-0">`
- Scripts at bottom: jQuery → Bootstrap bundle → WOW.js → `js/main.js` → `js/auth-navbar.js` → page-specific inline `<script>`

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
- `editor` + `admin`: see Add Article button
- `admin` only: see Manage Users button

**Token pattern** used in all authenticated pages:
```javascript
function isTokenValid(token) { /* checks JWT format + exp > now+30s */ }
async function refreshAccessToken() { /* POST /CRUD/auth/refresh with SUPABASE_ANON as Authorization */ }
async function ensureValidToken() { /* returns valid token or calls logout() */ }
```
Refresh endpoint requires `Authorization: Bearer ${SUPABASE_ANON}` (not user JWT).

**Auth navbar** (`js/auth-navbar.js`): Included in all public pages. Hides `.login-btn` and injects Home + Logout buttons when `localStorage.access_token` exists.

### Supabase Edge Function (`/functions/v1/CRUD/`)

All routes go through one Edge Function. Key behaviour:
- **GET /articles** — public, accepts anon key as Authorization
- **POST /articles**, **PATCH /articles/:id**, **DELETE /articles/:id** — requires user JWT validated via `supabase.auth.getUser(token)`
- The Edge Function reads user JWT from `x-access-token` header (custom) to bypass Supabase gateway JWT validation. `Authorization` header must always be `Bearer ${SUPABASE_ANON}` for all Edge Function calls.
- **POST /auth/register** — accepts anon key as Authorization (same as login)

**Article table required fields**: `title`, `content`, `slug` (generate from title + `Date.now()`), `status` (use `"published"`). `image_link` is optional — omit the key entirely if no image rather than sending `null`.

**Supabase REST API** (used for users/roles, bypasses Edge Function):
- `GET /rest/v1/users?select=*,roles!role_id(role_name)` — join syntax for FK
- `PATCH /rest/v1/users?id=eq.${id}` — update user fields
- Uses `Authorization: Bearer ${userToken}` + `apikey: ${SUPABASE_ANON}`

### Admin Section (`/admin/`)

| File | Purpose |
|------|---------|
| `add_article.html` | Create article — editor/admin only |
| `edit_article.html` | Edit/delete article — editor/admin only, pre-fills form from `?id=` param |
| `manage_users.html` | CRUD users — admin only; edit modal shows only role dropdown; current user row shows no action buttons |
| `add_user.html` | Legacy standalone add user (now superseded by manage_users.html) |

Admin pages use `../` relative paths for all assets.

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
