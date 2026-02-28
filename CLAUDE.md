# Hardwave Studios - Claude Instructions

## Cross-Compilation
- NEVER use MinGW (x86_64-pc-windows-gnu) for Windows VST3 builds. COM vtable layout is incompatible. Use cargo-xwin with x86_64-pc-windows-msvc.
- cargo xtask bundle does NOT work with cargo-xwin. Manually create VST3 bundle structure.

## wry WebView
- Always set explicit `.with_bounds()` — default is 0x0.
- Always set `.with_transparent(false)` and `.with_background_color((r,g,b,255))`.
- Set `.with_visible(true)` and `.with_focused(true)` for immediate rendering.
- **Windows: use `build()` NOT `build_as_child()`.** `build_as_child()` does NOT attach wry's parent subclass, so `WM_WINDOWPOSCHANGED` → `NotifyParentWindowPositionChanged()` never fires → WebView2 DirectComposition doesn't know screen position → ghosting. `build()` creates the same WS_CHILD container but also subclasses the parent for WM_SIZE/WM_SETFOCUS/WM_WINDOWPOSCHANGED. Create on DAW's UI thread (spawned thread = black screen due to child window thread affinity).
- **Windows: MUST set a writable WebView2 data directory** via `WebContext::new(Some(path))` + `WebViewBuilder::with_web_context()`. Default is the executable's folder (DAW's Program Files) → `E_ACCESSDENIED`. Use `%LOCALAPPDATA%\Hardwave\WebView2`.
- Linux: create webview on a spawned thread with GTK init + event loop. Gate all gtk usage with `#[cfg(all(target_os = "linux", feature = "gtk"))]`.
- **Windows: NEVER call `evaluate_script` from a background thread.** `ICoreWebView2::ExecuteScript` is STA-bound — cross-thread calls fail silently. Instead, use `with_custom_protocol("hwpacket", ...)` (runs on UI thread) and have JS poll `http://hwpacket.localhost/` via `fetch()`. Add `Access-Control-Allow-Origin: *` to the response. `http://*.localhost/` is trusted by Chrome so HTTPS pages can fetch it without mixed-content blocking.

## VST Plugins
- Never spawn threads or do I/O in `Default::default()` — DAWs call this during plugin scan.
- Defer heavy init to `initialize()`.

## CI/CD
- Self-hosted runner at ~/actions-runner/ for Dishairano/hardwave-analyser-vst.
- Runner can't sudo — install system deps manually.

## Monorepo Structure
This repo is a Turborepo monorepo. The web platform lives in `apps/` and `packages/`.

```
apps/main        → hardwavestudios.com      (@hardwave/main)
apps/erp         → erp.hardwavestudios.com  (@hardwave/erp)
apps/analyser    → analyser.hardwavestudios.com  (@hardwave/analyser-app)
apps/wettboi     → wettboi.hardwavestudios.com   (@hardwave/wettboi-app)
packages/shared  → server-side shared logic (@hardwave/shared)
packages/ui      → Radix/Shadcn components  (@hardwave/ui)
packages/analyser-engine → DSP + AnalyserCanvas (@hardwave/analyser-engine)
```

**Key commands:**
- `npm run migrate` — apply pending SQL migrations (from repo root)
- `npm run migrate:status` — show which migrations are applied
- `turbo build --filter=@hardwave/main` — build only one app
- Each app `next dev` runs on its own port (main:3001, erp:3002, analyser:3003, wettboi:3004)

**Database:** Single shared MySQL instance. All 4 apps connect to the same DB.
- Migrations live in `migrations/*.sql` (lexicographically ordered, 001_ prefix)
- Migration runner: `scripts/migrate.ts` — tracks applied migrations in `schema_migrations` table
- Add new migrations as `NNN_description.sql` — never edit existing applied migrations

**Shared packages use shim pattern:** Apps keep `@/lib/auth` etc. local paths that re-export from `@hardwave/shared`. This means zero import changes in app code when adding new exports to shared.

**Deploy:** Each server's `deploy/*/docker-compose.yml` points build context at monorepo root and uses `apps/<name>/Dockerfile` which runs `turbo prune` to include only relevant code. `.env.local` lives at the monorepo root (not inside `website/` or any app).

**SITE_SCOPE is gone.** Do NOT add it back. Each server runs only its own app — no middleware routing needed.
