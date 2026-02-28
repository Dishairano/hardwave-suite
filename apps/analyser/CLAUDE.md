# apps/analyser — CLAUDE Instructions

**Domain:** analyser.hardwavestudios.com
**Package:** `@hardwave/analyser-app`
**What it is:** The VST webview for the Hardwave Analyser plugin. Loaded by `wry` inside the plugin's editor window — NOT a general-purpose web page.

## What lives here
- `/vst/analyser` — the analyser UI page (root `/` redirects here)
- `/api/auth/**` — login, me, register, forgot/reset password
- `/api/subscription` — checks if the user has an active subscription
- `/api/license/verify` — license key verification

## What does NOT live here
- Dashboard, pricing, ERP → other apps
- WettBoi VST → `apps/wettboi`

## The VST context
This page is loaded by the `wry` WebView in `hardwave-bridge/src/editor.rs`. Key facts:

- **Token:** The plugin stores the user's JWT in `localStorage` under `hardwave_vst_token`. On load, the page reads this and uses it for API calls. If absent, show a "please log in at hardwavestudios.com" message.
- **Audio data (Windows):** Plugin sends FFT data via the `hwpacket://` custom protocol. The page polls `http://hwpacket.localhost/` at ~60fps with `fetch()` and passes each binary packet to `window.__onAudioPacket`. Do NOT use WebSockets for this — they don't work in the wry/WebView2 STA context.
- **Audio data (Linux):** Plugin sends via WebSocket on `ws://localhost:PORT`. The port is embedded in the page URL query string or a global injected by the plugin.
- **No navigation:** This page must never redirect away — it's trapped inside the plugin window.
- **Transparent background:** The page background should match the plugin's dark theme. Use `background: #0a0a0f` or similar.

## Shared packages
- `@hardwave/shared` — auth, db, types (server-side only in API routes)
- `@hardwave/analyser-engine` — DSP engine (types, math, engine, renderer) + AnalyserCanvas component

**Shim pattern:** `@/lib/analyser/*` re-exports from `@hardwave/analyser-engine`. `@/components/AnalyserCanvas` re-exports from the engine package.

## AnalyserCanvas
The main UI component. Import via the shim:
```typescript
import AnalyserCanvas from '@/components/AnalyserCanvas';
```
It reads settings from `localStorage` (bands, scale, color theme) and renders to a `<canvas>`. The engine runs in a `useRef` — do not remount it on every render.

## Minimal bundle
This app intentionally has no Stripe, no Refine, no PWA, no framer-motion. Keep it that way — the VST webview should load fast.

## Do not
- Add heavy deps. If you think you need a new package, ask first.
- Add public-facing pages or non-VST API routes.
- Call `evaluate_script` or inject data from a background thread on Windows — use the hwpacket custom protocol instead (see root CLAUDE.md).
- Add `SITE_SCOPE` checks.
