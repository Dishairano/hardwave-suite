# apps/erp — CLAUDE Instructions

**Domain:** erp.hardwavestudios.com
**Package:** `@hardwave/erp`
**What it is:** Internal ERP system for Hardwave Studios staff — CRM, finance, HR, inventory, invoicing, projects, plus the legacy admin panel (redirects to `/erp`).

## What lives here
- `/erp/**` — all ERP pages (dashboard, CRM, finance, HR, inventory, invoicing, projects, settings, agenda)
- `/admin/**` — redirects to `/erp` (kept for backward compat with bookmarks)
- `/contracts/sign/[token]` — external contract signing is served here too (ERP manages HR contracts)
- `/uploads/**` — contract PDF uploads
- `/api/erp/**` — all ERP API routes (~114 route handlers)
- `/api/admin/**` — legacy admin API routes
- `/api/auth/**` — ERP users authenticate separately (same JWT, same DB)

## What does NOT live here
- Public site, pricing, dashboard → `apps/main`
- VST webviews → `apps/analyser`, `apps/wettboi`

## Shared packages
- `@hardwave/shared` — auth, db, erp, erp-types, refine-*, contract-storage, pdf-signer, notifications
- `@hardwave/ui` — UI primitives (button, table, card, etc.)

**Shim pattern:** Same as apps/main. `@/lib/erp.ts` → `@hardwave/shared/erp`, etc.

## ERP Framework (Refine)
This app uses `@refinedev/core` with a custom data provider (`@/lib/refine-data-provider`).
- Data provider maps Refine CRUD operations to the `/api/erp/**` REST endpoints.
- Access control via `@/lib/refine-access-control` — checks ERP role from JWT.
- ERP roles: `erp_admin`, `finance_manager`, `project_manager`, `hr_manager`, `sales_rep`, `accountant`, `employee`. Defined in `001_erp_core.sql`.

## HR Contracts
- Contract PDFs generated with `pdf-lib`, signed fields positioned by `contract_signature_positions` table.
- External signing: `/api/erp/hr/contracts/public/[token]` is the public endpoint — accessible without ERP login. Served by this app (not apps/main).
- Contract files stored at `/public/uploads/contracts/` inside the container. The Docker volume mounts this directory so files persist across rebuilds.

## Auth
- Same JWT as apps/main — `verifyAuth()` from `@/lib/auth`.
- ERP routes additionally check `erp_user_roles` table for module-level permissions.
- ERP login page: `/erp` redirects to Refine's auth flow.

## Database
- Same shared MySQL instance as all other apps.
- Schema: ERP tables are all prefixed `erp_` (except `erp_roles`, `erp_user_roles`).
- New ERP schema changes: add a migration file at `migrations/NNN_description.sql` in the repo root.

## Conventions
- API routes follow REST: `GET /api/erp/crm/contacts` (list), `POST` (create), `GET /[id]` (get one), `PUT /[id]` (update), `DELETE /[id]` (delete).
- All ERP API routes verify auth AND check ERP permissions before any DB query.
- Use `queryOne` / `query` from `@/lib/db` — never raw pool connections.
- Refine components in `src/components/erp/` — keep them in this app, not in packages/ui (they're ERP-specific).

## Do not
- Add Stripe or public-facing payment logic here.
- Import from `apps/main` or other apps.
- Add `SITE_SCOPE` checks.
- Put new ERP API endpoints in `apps/main`.
