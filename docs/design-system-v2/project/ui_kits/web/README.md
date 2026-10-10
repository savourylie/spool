# Spool web — UI kit

A click-through prototype recreating the Spool dashboard (the only Spool product surface). Built from the Next.js codebase in `spool/` — sources of truth are `src/app/page.tsx`, `src/app/loading/page.tsx`, `src/components/ui/*`, and `src/components/dashboard/*`.

## What's in it

```
index.html              ← entry; loads all .jsx files in order
kit.css                 ← prototype-only styles (sticker card, candy button, etc.)
primitives.jsx          ← StickerCard, Button, IconCircle, Eyebrow, QualityGauge, ProgressBar
icons.jsx               ← Phosphor-look inline SVGs (Icon name="...")
Sidebar.jsx             ← left sidebar (Today / Understand / Create)
Banners.jsx             ← Token expiry, backfill, viral recovery
Shell.jsx               ← sidebar + sticky header + content shell

Landing.jsx             ← marketing landing page
Loading.jsx             ← first-run /loading page with animated progress
PostsScreen.jsx         ← post performance table + format analysis
TimingScreen.jsx        ← 7×24 timing heatmap + cadence optimizer
AudienceScreen.jsx      ← follower growth + demographics + collapsible insights
ScannerScreen.jsx       ← content quality scanner (textarea → gauge → issues + rewrites)
ComposerScreen.jsx      ← AI composer (topic + style → streaming drafts + right panel)
app.jsx                 ← hash router & Today screen
```

## How to navigate

`index.html` uses hash routes. Click the sidebar or the in-page CTAs to move between:

- `#landing` — marketing landing
- `#loading` — first-run progress (auto-redirects to Posts when "done")
- `#today` — overview
- `#posts` — post performance table (try clicking a row to expand the detail panel)
- `#timing` — heatmap + cadence
- `#audience` — growth + demographics + collapsibles
- `#scanner` — type or paste to see a fake analysis stream in
- `#composer` — set topic + style, click Generate, watch drafts stream

## Faithful to the codebase

- **Sticker card primitive** is a direct port of `src/components/ui/card.tsx` (`StickerCard` + `StickerCardIcon`).
- **Candy button** matches `src/components/ui/button-variants.ts` (pill, 2px border, hard shadow, bounce easing on hover/active).
- **Inputs** match `src/components/ui/input.tsx` — `border-input-border` resting → `border-accent` + accent shadow on focus.
- **QualityGauge** is a port of `src/components/dashboard/quality-gauge.tsx`, including the 0–40 / 40–70 / 70–100 red/amber/mint zones.
- **Heatmap** colors interpolate between `hsl(210,40%,96%)` and `hsl(263,90%,66%)`, matching `src/components/dashboard/timing-heatmap.tsx`.
- **Composer** mirrors the state shape from `src/components/dashboard/composer.tsx` (status, drafts, style presets) but uses fake local streaming instead of SSE.
- **Sidebar** matches the section layout from `src/components/dashboard/dashboard-sidebar.tsx`.

## Where it cuts corners

- No real OAuth / Threads API — buttons are visual only.
- LLM calls are replaced with deterministic local stubs (`fakeAnalysis` in Scanner, `DRAFT_TEMPLATES` in Composer).
- Recharts is replaced with hand-rolled SVG charts (FollowerChart, Bar, Donut, Sparkline).
- Phosphor icon imports are inline SVGs in `icons.jsx` matching the regular weight (2.5 stroke, round caps).
- Mobile tab bar is omitted; the prototype is desktop-only.
- Dev/insights/voice tabs are stubbed as placeholders.

## When to use this kit

When building a new Spool screen, mock, marketing artifact, or feature pitch — open `index.html` for a faithful click-through reference, copy the primitives you need, and lift styles from `kit.css`. For production code, switch to the real `src/components/ui/*` and Phosphor React imports.
