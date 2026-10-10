---
name: spool-design
description: Use this skill to generate well-branded interfaces and assets for Spool — a Threads analytics dashboard — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping in the "Playful Geometric / Stable Grid, Wild Decoration" style.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files. The most important files are:

- `README.md` — full content + visual foundations (colors, type, motion, hover/press states, layout, iconography rules)
- `colors_and_type.css` — drop-in CSS variables and base styles (mirrors the codebase's `globals.css`)
- `ui_kits/web/primitives.jsx` — StickerCard, CandyButton, Input, IconCircle, Eyebrow, EmptyState, ProgressBar
- `ui_kits/web/index.html` — full clickable dashboard prototype demonstrating composition
- `preview/*.html` — atomic per-token / per-component reference cards

Spool's house style is "Stable Grid, Wild Decoration" — content lives in clean readable areas, everything around it is alive with shape, color, and movement. Optimistic, tactile, fun. Light mode only, cream paper background, hard zero-blur shadows, pill buttons with 2px black borders, "sticker cards" with floating colored icon circles, Phosphor icons always enclosed in colored circles, **no emoji**, em-dashes freely, second-person voice, sentence case copy.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Always include `colors_and_type.css` and use the `StickerCard` / candy button / icon-circle vocabulary — these are the brand's signatures.

If working on production code, the codebase is Next.js 16 + Tailwind v4 + shadcn/ui + Base UI + Phosphor + Framer Motion + Recharts. Read the rules here, copy assets, and reference the existing primitives in `src/components/ui/` rather than re-deriving them.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (especially about which Spool surface — landing, loading, dashboard, scanner, composer — they want to extend), and act as an expert designer who outputs HTML artifacts or production code depending on the need.

Avoid: emoji, glass-morphism / backdrop-blur, soft blurry shadows, dark mode, photography, big gradient page backgrounds, exclamation marks in copy, first-person ("I"), generic blue/purple AI gradients.
