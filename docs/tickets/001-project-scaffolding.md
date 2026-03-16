# [TICKET-001] Project Scaffolding & Design Tokens

## Status
`done`

## Dependencies
- Requires: None

## What Changed

- Scaffolded Next.js 16.1.6 (App Router, TypeScript, Tailwind v4, Turbopack) — commit `de4c1df`
- Installed all core deps: `@supabase/supabase-js`, `@supabase/ssr`, `@phosphor-icons/react`, `framer-motion`, `animejs`, `@tanstack/react-query`; shadcn/ui initialized with `cn()` helper and Button primitive
- Built full design token system in `src/app/globals.css` using Tailwind v4 `@theme inline` directives (replaces `tailwind.config.ts`) — all DESIGN.md colors, radii, hard shadows, and bounce easing mapped to utility classes
- Loaded Outfit (700, 800) and Plus Jakarta Sans (400, 500) via `next/font/google` in `src/app/layout.tsx`
- Added `prefers-reduced-motion` media query to disable bounce/wiggle/marquee animations
- Created `.env.local` with Supabase env var placeholders; replaced Python `.gitignore` with Node.js/Next.js rules

### Deviations from Original Ticket

- **Tailwind v4**: Next.js 16 ships Tailwind v4, which uses CSS `@theme inline` in `globals.css` instead of `tailwind.config.ts`. All tokens configured via CSS — no `tailwind.config.ts` file exists.
- **Phosphor icons**: Per CLAUDE.md, `@phosphor-icons/react` replaces `lucide-react`. shadcn/ui may pull `lucide-react` as transitive dep — project code uses Phosphor.
- **shadcn charts over recharts**: `recharts` not installed directly — shadcn chart components (`npx shadcn@latest add chart`) pull it as a transitive dep when needed.

## Acceptance Criteria
- [x] ✅ Next.js 14+ App Router project created with TypeScript — **Next.js 16.1.6** with Turbopack
- [x] ✅ Dependencies installed: `@supabase/supabase-js`, `@supabase/ssr` — plus `@phosphor-icons/react` (replaces `lucide-react` per CLAUDE.md), `framer-motion`, `animejs`, `@tanstack/react-query`; `recharts` deferred to shadcn chart component
- [x] ✅ shadcn/ui initialized and configured — `components.json`, `src/lib/utils.ts` (`cn()`), `src/components/ui/button.tsx`
- [x] ✅ Tailwind config extended with all DESIGN.md color tokens — `background` (#FFFDF5), `foreground` (#1E293B), `muted`, `accent` (#8B5CF6), `secondary` (#F472B6), `tertiary` (#FBBF24), `quaternary` (#34D399), `border`, `input`, `card`, `ring`, plus `primary`, `popover`, `destructive`, chart-1–5, sidebar tokens
- [x] ✅ Tailwind config extended with DESIGN.md radius tokens — `radius-sm: 8px`, `radius-md: 16px`, `radius-lg: 24px` (via `@theme inline`; `rounded-full` is built-in)
- [x] ✅ Tailwind config extended with DESIGN.md shadow tokens — `shadow-default`, `shadow-hover`, `shadow-active`, `shadow-soft`, `shadow-featured` (all hard, zero blur)
- [x] ✅ Google Fonts loaded: Outfit (700, 800) → `--font-outfit` / `font-heading`; Plus Jakarta Sans (400, 500) → `--font-plus-jakarta-sans` / `font-sans`
- [x] ✅ `globals.css` includes CSS custom properties for all tokens — `:root` block with full DESIGN.md palette
- [x] ✅ `globals.css` includes bounce timing function — `--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)` → `ease-bounce` utility
- [x] ✅ Root layout applies fonts and base background color — `layout.tsx` sets font CSS vars on `<body>`; `@layer base` applies `bg-background text-foreground font-sans`; headings use `font-heading`
- [x] ✅ `prefers-reduced-motion` media query disables bounce/wiggle animations — forces `ease`, zeroes `animation-duration` and `transition-duration`
- [x] ✅ `npm run build` passes; page renders with correct fonts and warm cream background

## Design Reference
- **Tokens**: § Tokens > Colors, Typography, Spacing, Radius, Shadows
- **Motion**: § Motion & Animation (bounce timing function, reduced motion)
- **Visual Signatures**: § Visual Signatures (primitive shapes, hard shadows, pattern fills, mixed radii)

## Implementation Notes
- **No `tailwind.config.ts`** — Tailwind v4 uses CSS-only config via `@theme inline` in `src/app/globals.css`
- Key files: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `components.json`, `src/lib/utils.ts`
- Use CSS custom properties in `globals.css` so shadcn/ui components pick them up automatically
- The bounce easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) is available as `ease-bounce` Tailwind utility
- Border width defaults to 2px per DESIGN.md — left for component-level `border-2` usage in #003
- 8px base grid spacing is Tailwind's default (1 unit = 4px, so `gap-2` = 8px) — no custom config needed

## Testing
- `npm run build` ✅ — compiles successfully, static pages generated
- Verification page at `/` renders "Spool" heading + tagline
- Background: `#FFFDF5` (warm cream) via `bg-background`
- Tailwind utilities resolve: `bg-accent`, `shadow-default`, `rounded-lg`, `ease-bounce`, `text-muted-foreground`, `bg-tertiary`, `bg-quaternary`
