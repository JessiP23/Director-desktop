# Director Desktop

Native macOS + Windows app for **Director**, WM Studio's creative production agent.

It is a **thin client** of the existing WM Studio backend: the agent, brief,
specialists, media generation and billing all stay server-side. This app signs
in with Supabase, gets a JWT, and talks to `/api/production-agent/*` over HTTP +
SSE — so the agent is *reused as-is*, not reimplemented.

- **Shell:** Tauri v2 (Rust core + system WebView)
- **UI:** React 19 + Vite + Tailwind v4
- **Auth:** Supabase JWT → `Authorization: Bearer`, session stored in the OS keychain

---

## Quick start

```bash
cp .env.example .env.local      # fill in API base URL + Supabase values
pnpm install
pnpm tauri dev                  # native window with hot reload
```

`pnpm dev` runs the UI in a plain browser tab (no native features; secure
storage falls back to localStorage). `pnpm tauri dev` is the real app.

### Build a desktop bundle

```bash
pnpm tauri build                # .app / .dmg (macOS) or .msi / .exe (Windows)
```

---

## Project structure

```
src/
  App.tsx                         auth gate → SignIn or the workspace
  main.tsx                        entry; imports the global stylesheet
  styles/globals.css              Tailwind v4 + the cinematic design tokens

  lib/
    config.ts                     validated env (API base URL, Supabase)
    utils/cn.ts                   className merge helper
    auth/supabase.ts              Supabase client; session → OS keychain (PKCE)
    tauri/secure-store.ts         JS bridge to the Rust keychain commands
    api/
      client.ts                   Bearer fetch wrapper (+ 401 refresh-and-retry)
      director.ts                 typed Director endpoints (runs, brief, stream)
      sse.ts                      fetch-based SSE reader (carries the auth header)
    director/
      contract/director.ts        COPIED contract types (keep in sync w/ backend)
      contract/brief.ts           COPIED brief types
      stream.ts                   COPIED event-log → StreamItem folding
      use-director-run-stream.ts  SSE subscription hook (fetch-based)

  components/
    ui/{button,spinner}.tsx       primitives
    layout/{app-shell,title-bar}.tsx   frameless window chrome

  features/
    auth/                         AuthProvider, context/useAuth, SignInScreen
    director/
      use-runs.ts                 run index (list/create/delete)
      use-run.ts                  single run: load + stream + send
      director-workspace.tsx      sidebar + conversation + composer
      run-sidebar.tsx
      conversation-view.tsx
      composer.tsx
      stream-item-view.tsx        renders each StreamItem kind

src-tauri/
  src/lib.rs                      Tauri builder + command registration
  src/secure_store.rs             OS keychain commands (keyring crate)
  tauri.conf.json                 window chrome, CSP, bundle
```

### The contract boundary

`src/lib/director/contract/*` is **copied** from wmstudio
(`src/lib/production-agent/types.ts`, `brief-types.ts`) and `stream.ts` from the
web dashboard. This is the only coupling to the backend. Keep it in sync — the
goal is to publish `@wmstudio/director-contract` and consume that instead of
copying. **Never** import wmstudio server code here.

---

## How it talks to the backend

| Action | Endpoint |
|---|---|
| List runs | `GET /api/production-agent/runs` |
| Create run | `POST /api/production-agent/runs` |
| Load run + events | `GET /api/production-agent/runs/:id` |
| Continue (send message) | `POST /api/production-agent/runs/:id` |
| Cancel / rename | `PATCH /api/production-agent/runs/:id` |
| Live events | `GET /api/production-agent/runs/:id/stream` (SSE) |
| Production brief | `GET/PATCH /api/director/:id/brief` |

**Why a custom SSE reader:** the browser `EventSource` can't send an
`Authorization` header. `lib/api/sse.ts` streams the response with `fetch` so the
Bearer JWT rides along. Behaviour matches the backend's `event:/data:` frames.

---

## Authentication

Three ways in, all against the same Supabase project as the web app:

- **Google / Apple** — opens the provider's consent screen in the **system
  browser**, which redirects to a temporary `http://localhost:<port>` loopback
  server the app opens for the duration of sign-in (`lib/auth/oauth.ts`, via
  `tauri-plugin-oauth`). The app reads the `?code=` and exchanges it for a
  session. No custom URL scheme, so it works the same in `tauri dev` and in a
  built app — this is the RFC 8252 native-app pattern, and Google/Apple require
  the system browser (they block embedded webviews).
- **Email / password** — direct Supabase sign-in.

**Supabase dashboard setup (one-time, Authentication → …):**
1. URL Configuration → **Redirect URLs**: add all three pinned loopback ports —
   `http://localhost:8788`, `http://localhost:8789`, `http://localhost:8790`.
   **If a redirect URL isn't allow-listed, Supabase falls back to the Site URL**
   (the web app) — that's the "lands on wmstudio, app keeps loading" symptom.
2. Providers → enable + configure **Google** and **Apple** (Apple also needs an
   Apple Developer Services ID; the app code is provider-agnostic).

The browser shows a branded "you're signed in, return to Director" page after
the redirect; the desktop app is already authenticated by then.

> The provider's own console (Google Cloud OAuth client / Apple Services ID)
> only ever needs the Supabase callback `https://<project>.supabase.co/auth/v1/callback`
> — **not** the localhost URL. Localhost only goes in Supabase's Redirect URLs.

Run the authenticated smoke test (no GUI):

```bash
TEST_EMAIL=you@studio.com TEST_PASSWORD=... pnpm smoke
```

## Security

- The Supabase **refresh token lives in the OS keychain** (macOS Keychain /
  Windows Credential Manager) via `keyring`, not in web storage.
- The WebView **CSP** (in `tauri.conf.json`) restricts `script-src` to `'self'`
  and only allows `https:`/`wss:` for network + media.
- The app ships **no secrets** beyond the public Supabase anon key.

---

## Roadmap (port + native superpowers)

This repo currently delivers the core Director loop: auth, run list, live
conversation, generation/confirmation cards. Next, in rough order:

1. **OAuth sign-in** — system browser (PKCE) → `director://` deep link
   (`tauri-plugin-deep-link`), replacing/augmenting email+password.
2. **Auto-update** — `tauri-plugin-updater` + signed release manifest.
3. **Native superpowers** — drag from Finder → composer (attachments via
   `/api/production-agent/attachments`), native notification on `run.completed`
   (so a render can finish while the app is backgrounded), save generations to a
   local library.
4. **Rich panels** — brief/references panel, editor timeline, generations
   archive, memory, skills (port from the wmstudio dashboard components).
5. **Windows polish + code signing**, then ship.

See `../DIRECTOR_DESKTOP_SPRINT.md` and `../DIRECTOR_DESKTOP_FEATURES.md`.
