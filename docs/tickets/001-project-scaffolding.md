# [TICKET-001] Project Scaffolding & Design Tokens

## Status
`pending`

## Dependencies
- Requires: None

## Description
Initialize the Next.js project with App Router, install core dependencies (shadcn/ui, Recharts, Supabase client, Lucide React), and configure the design token system from DESIGN.md. This is the foundation ticket — everything else depends on it.

## Acceptance Criteria
- [ ] Next.js 14+ App Router project created with TypeScript
- [ ] Dependencies installed: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `recharts`
- [ ] shadcn/ui initialized and configured
- [ ] Tailwind config extended with all DESIGN.md color tokens (`background`, `foreground`, `muted`, `accent`, `secondary`, `tertiary`, `quaternary`, `border`, `input`, `card`, `ring`)
- [ ] Tailwind config extended with DESIGN.md radius tokens (`radius-sm: 8px`, `radius-md: 16px`, `radius-lg: 24px`, `radius-full: 9999px`)
- [ ] Tailwind config extended with DESIGN.md shadow tokens (default, hover, active, soft, featured)
- [ ] Google Fonts loaded: Outfit (700, 800) and Plus Jakarta Sans (400, 500)
- [ ] `globals.css` includes CSS custom properties for all tokens
- [ ] `globals.css` includes bounce timing function: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- [ ] Root layout (`layout.tsx`) applies fonts and base background color
- [ ] `prefers-reduced-motion` media query disables bounce/wiggle animations
- [ ] `npm run dev` starts without errors and shows the default page with correct fonts and background

## Design Reference
- **Tokens**: § Tokens > Colors, Typography, Spacing, Radius, Shadows
- **Motion**: § Motion & Animation (bounce timing function, reduced motion)
- **Visual Signatures**: § Visual Signatures (primitive shapes, hard shadows, pattern fills, mixed radii)

## Implementation Notes
- Key files: `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `components.json`
- Use CSS custom properties in `globals.css` so shadcn/ui components pick them up automatically
- The bounce easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) should be a Tailwind utility class (e.g., `ease-bounce`)
- Border width defaults to 2px per DESIGN.md — configure as a utility or base style
- 8px base grid spacing is Tailwind's default (1 unit = 4px, so `gap-2` = 8px) — no custom config needed

## Testing
- Run `npm run dev` and verify the page loads at `localhost:3000`
- Inspect the page: confirm Outfit font on headings, Plus Jakarta Sans on body text
- Confirm background color is `#FFFDF5` (warm cream)
- Verify Tailwind classes like `bg-accent`, `shadow-hard`, `rounded-radius-lg` resolve correctly
