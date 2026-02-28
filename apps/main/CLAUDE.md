# apps/main — CLAUDE Instructions

**Domain:** hardwavestudios.com
**Package:** `@hardwave/main`
**What it is:** Public marketing site + customer dashboard + PWA sample library + browser analyser tool.

## What lives here
- `/` homepage, `/pricing`, `/changelog`, `/roadmap`, `/privacy`, `/terms`, `/products/**`
- `/(auth)/login`, `/(auth)/register`, `/forgot-password`, `/reset-password`
- `/dashboard/**` — subscription, orders, invoices, downloads, settings
- `/app/**` — PWA sample library + audio tools (analyser, key detector, BPM changer, pitch shifter, etc.)
- `/contracts/sign/[token]` — external contract signing (public URL, no auth required)
- `/downloads`, `/design/**`, `/uploads/**`
- `/api/auth/**`, `/api/account/**`, `/api/subscription`, `/api/stripe/**`
- `/api/library/**`, `/api/orders`, `/api/downloads/**`, `/api/download-file/**`
- `/api/invoices`, `/api/license/**`, `/api/updates/**`, `/api/cron/**`

## What does NOT live here
- ERP/admin pages → `apps/erp`
- VST webview pages (`/vst/**`) → `apps/analyser` or `apps/wettboi`
- `/api/erp/**` and `/api/admin/**` → `apps/erp`

## Shared packages
This app uses three packages from the monorepo:
- `@hardwave/shared` — auth, db, types, stripe, email, pwa utilities
- `@hardwave/ui` — Radix/Shadcn UI components and hooks
- `@hardwave/analyser-engine` — DSP engine + AnalyserCanvas component

**Shim pattern:** All local `@/lib/*` and `@/components/ui/*` imports are shims that re-export from the shared packages. Do NOT copy logic directly into this app — fix the shim or update the package instead.

```typescript
// src/lib/auth.ts (shim — do not edit logic here)
export * from '@hardwave/shared/auth';

// src/components/ui/button.tsx (shim)
export * from '@hardwave/ui/button';
```

## Auth
- JWT Bearer tokens. `verifyAuth(request)` from `@/lib/auth` (→ `@hardwave/shared/auth`).
- Token stored in `localStorage.getItem('token')` for browser sessions.
- VST webview uses `hardwave_vst_token` key instead.

## Database
- Connect via `@/lib/db` (→ `@hardwave/shared/db`).
- Use `query<T>()` and `queryOne<T>()` helpers — never import `pool` directly in pages.
- Schema changes go in `migrations/` at the **repo root** — never inline DDL in route handlers.

## Conventions
- All API routes: check auth with `verifyAuth()`, return `{ error }` with appropriate status on failure.
- Stripe webhook route uses raw body — do NOT add `bodyParser` to it.
- PWA components live in `src/components/pwa/` — they use the Web APIs (AudioContext, IndexedDB) and must be `'use client'`.
- `/app/**` pages require a valid subscription — check `hasSubscription` from `/api/subscription`.

## Do not
- Add ERP-specific deps (Refine, signature_pad for contracts belongs only in the signing page) to this app's broad bundle.
- Import from `apps/erp` — shared logic goes through `packages/shared`.
- Add `SITE_SCOPE` env checks — this app always serves its own routes.
