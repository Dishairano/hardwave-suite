# packages/shared — CLAUDE Instructions

**Package:** `@hardwave/shared`
**What it is:** The single source of truth for all shared server-side business logic across the monorepo. Every app imports from here via shims.

## Contents

| File | Purpose |
|---|---|
| `auth.ts` | JWT token creation/verification, `verifyAuth()` middleware helper |
| `db.ts` | MySQL connection pool, `query<T>()`, `queryOne<T>()` |
| `types.ts` | Shared TypeScript types (User, Subscription, License, etc.) |
| `utils.ts` | `cn()` class merge helper and other pure utilities |
| `email.ts` | Resend email client, transactional email functions |
| `notifications.ts` | In-app notification creation (writes to DB) |
| `stripe.ts` | Stripe server SDK instance + webhook helpers |
| `stripe-client.ts` | Stripe publishable key for client-side use |
| `erp-types.ts` | TypeScript types for all ERP entities |
| `erp.ts` | ERP helper functions (permissions, role checks) |
| `contract-storage.ts` | Contract PDF file storage helpers |
| `pdf-signer.ts` | pdf-lib based contract signing |
| `refine-*.ts` | Refine data/auth/access providers (used by apps/erp only) |
| `pwa/*` | PWA utilities — audio player, haptics, share, storage, sync, timestretch |

## Sub-path exports
Import specific modules directly to avoid pulling in unused code:
```typescript
import { verifyAuth } from '@hardwave/shared/auth';
import { query } from '@hardwave/shared/db';
import type { User } from '@hardwave/shared/types';
import { sendEmail } from '@hardwave/shared/email';
```

## Adding new shared logic
1. Create a new `.ts` file in `src/`.
2. Add a sub-path export to `package.json` `exports` field:
   ```json
   "./my-module": "./src/my-module.ts"
   ```
3. Re-export from `src/index.ts` for the barrel import.
4. Add shim files in each app that needs it (`src/lib/my-module.ts` → `export * from '@hardwave/shared/my-module'`).

## Database schema changes
**Do NOT add inline DDL (CREATE TABLE, ALTER TABLE) to any file here.** Add a new migration file:
```
migrations/NNN_description.sql   ← at the monorepo root
```
Run `npm run migrate` from the repo root to apply it.

## Constraints
- This package has **no dependency on Next.js** internals. It can use `next/headers`, `next/server` if needed but only in route-handler-specific helpers.
- Never import from `apps/*` — this package is consumed BY apps, not the other way around.
- Keep `pwa/*` browser-safe — no Node.js APIs in the pwa/ utilities (they run in the browser).
- Server-only modules (`db.ts`, `auth.ts`, `email.ts`, `stripe.ts`) must not be imported in client components. Use the `'server-only'` marker if it becomes an issue.

## Tests
No test runner is currently configured. If adding tests, put them in `src/__tests__/` and use Node's built-in test runner.
