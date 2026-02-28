# packages/ui — CLAUDE Instructions

**Package:** `@hardwave/ui`
**What it is:** Shared React UI component library — Radix UI primitives styled with Tailwind, plus shared hooks. Based on the shadcn/ui pattern.

## Contents

**Components** (`src/`):
`accordion`, `alert`, `avatar`, `badge`, `button`, `card`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `table`, `textarea`

**Hooks** (`src/hooks/`):
- `use-toast.ts` — toast notification state hook
- `useMediaQuery.ts` — responsive breakpoint hook

**Utilities** (`src/utils.ts`):
- `cn()` — `clsx` + `tailwind-merge` class name helper

## How apps consume this
Each app has shim files like:
```typescript
// apps/main/src/components/ui/button.tsx
export * from '@hardwave/ui/button';

// apps/main/src/hooks/use-toast.ts
export * from '@hardwave/ui/hooks/use-toast';
```
Apps still import via `@/components/ui/button` — they never need to know about `@hardwave/ui` directly.

## Adding a new component
1. Create `src/my-component.tsx`.
2. Use only relative imports (e.g., `from './utils'` for `cn`).
3. Add the export to `src/index.ts`.
4. Add a sub-path entry to `package.json` exports:
   ```json
   "./my-component": "./src/my-component.tsx"
   ```
5. Add shim files in each app that needs it.

## Style rules
- Use Tailwind CSS v4 utility classes only (no inline styles, no CSS modules).
- Use CSS custom properties (`--background`, `--foreground`, etc.) for theme tokens — they're set in each app's `globals.css`.
- Use `cn()` from `./utils` for conditional class merging.
- Use Radix UI primitives for interactive elements (dropdown, select, etc.) — do NOT use native browser `<select>`, `<dialog>`, etc.
- Components must be accessible: proper ARIA attributes, keyboard nav, focus styles.

## Constraints
- **No Next.js-specific imports** (no `next/image`, `next/link`, etc.). This package must stay framework-adjacent — usable in any React app.
- **No server-only code.** All components are client-side React.
- **No heavy deps.** Do not add large libraries (chart libs, animation libs, etc.) here — add them to the specific app that needs them.
- `'use client'` is NOT needed here — each consuming app controls client/server boundaries. If a component needs `'use client'`, put that directive in the app's shim.

## Updating an existing component
Edit the file in `packages/ui/src/` directly. The change propagates to all apps automatically (they're all transpiled from source via `transpilePackages`). No publish step needed.
