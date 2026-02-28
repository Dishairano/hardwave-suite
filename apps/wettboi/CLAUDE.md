# apps/wettboi — CLAUDE Instructions

**Domain:** wettboi.hardwavestudios.com
**Package:** `@hardwave/wettboi-app`
**What it is:** The VST webview for the WettBoi plugin. Same architecture as `apps/analyser` but for WettBoi.

## What lives here
- `/vst/wettboi` — the WettBoi UI page (root `/` redirects here)
- `/api/auth/**` — login, me, register, forgot/reset password
- `/api/subscription` — subscription check
- `/api/license/verify` — license key verification

## Current state
The `/vst/wettboi` page is currently a **placeholder** — it shows an authorization check and a "coming soon" message. The actual WettBoi UI will be implemented here when the plugin is ready.

## VST context (same rules as apps/analyser)
- Token: `localStorage.getItem('hardwave_vst_token')` — set by the plugin before loading the page.
- Audio data: use `hwpacket://` custom protocol on Windows (poll `http://hwpacket.localhost/` via fetch). See root CLAUDE.md for why `evaluate_script` from background threads fails on Windows.
- No navigation away from the page.
- Dark background to match plugin UI.

## Shared packages
- `@hardwave/shared` — auth, db, types (API routes only)

No analyser-engine dependency — WettBoi has its own DSP. When WettBoi's UI is built, add its engine as a new package (`packages/wettboi-engine`) following the same pattern as `@hardwave/analyser-engine`.

## Do not
- Copy the AnalyserCanvas or analyser DSP logic here — WettBoi will have its own UI.
- Add Stripe, ERP, or PWA dependencies.
- Add `SITE_SCOPE` checks.
- Navigate away from `/vst/wettboi` — this is a trapped webview.

## When implementing the WettBoi UI
1. Create `packages/wettboi-engine` with the DSP types and React component.
2. Add `@hardwave/wettboi-engine` to this app's `package.json`.
3. Add it to `transpilePackages` in `next.config.ts`.
4. Replace the placeholder in `src/app/vst/wettboi/page.tsx`.
