# Spool Design System

> "Stable Grid, Wild Decoration."
> Content lives in clean, readable areas. Everything around it is alive with shape, color, and movement. Optimistic, tactile, fun — a well-organized sticker book.

## What is Spool?

**Spool** is an analytics dashboard for Threads creators. The product helps creators answer three questions: *what's working, when should I post, and what should I post next?* It does this by combining algorithm-aware analytics (a custom Weighted Engagement Score, timing heatmaps, audience-fit measures) with AI-powered tooling (a content quality Scanner and a draft Composer).

There is **one product**: the web dashboard at `localhost:3000` (Next.js 16 App Router). A small mobile tab bar lives at the bottom of the dashboard on narrow viewports but the core surface is desktop-first. The landing page (`/`) and a full-screen first-run `/loading` route bracket the dashboard shell.

## Source

This system is reverse-engineered from a single attached codebase:

- **Repo:** `spool/` (Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, Base UI primitives, Phosphor icons, Framer Motion + Anime.js, Recharts, Supabase, Anthropic + OpenAI SDKs)
- **Design source of truth:** `spool/docs/DESIGN.md` — "Playful Geometric" spec
- **UX source of truth:** `spool/docs/UX_DESIGN.md` — full IA, flows, state coverage
- **Live tokens:** `spool/src/app/globals.css`
- **Component primitives:** `spool/src/components/ui/` (Sticker card, candy button, input, empty/error states, progress bar)
- **Product surfaces:** `spool/src/app/page.tsx`, `spool/src/app/loading/page.tsx`, `spool/src/app/dashboard/*`

No Figma, screenshots, or other resources were provided — the codebase was rich enough to source everything visually.

---

## Content fundamentals

The voice is **direct, second-person, lowercase-ambitious**. Spool addresses a creator one-on-one and treats their data as the subject. There is no inflated marketing English, no exclamation points, no emoji.

**Tone:** confident · plain · pragmatic. Never twee, never preachy.

**Person:** second-person ("your posts", "your audience", "you always post Tue 9 AM"). Spool itself is the second voice when explaining ("we'll check for patterns the algorithm demotes"). First-person plural is the product voice; never use "I".

**Casing:** Sentence case for everything except product nouns ("Threads", "Spool") and proper section/tab names ("Posts", "Timing", "Audience", "Scanner", "Compose"). H1 stays sentence-case ("Analytics that understand the algorithm"). UPPERCASE is reserved for eyebrow labels and field labels, 11px with `tracking-wide`.

**Punctuation:** em-dashes between clauses (` — `) — used freely. Sentences end in periods. No exclamation marks. Numerals over words for any quantity (`12 posts`, not "twelve").

**Emoji:** never. The brand expresses itself through shape, color, and Phosphor iconography — not emoji. Unicode arrows (`→`) are okay in CTAs but are usually preferred as Phosphor `ArrowRight` icons inside a small white pill at the end of the candy button.

**Vibe:** Cheerful but never juvenile. The visual language is playful so the copy is allowed to be matter-of-fact.

**Concrete examples** lifted directly from the product:

- Hero: "Spool / See what's working, understand the algorithm, and know what to post next."
- Feature card: "Weighted Performance — See how the algorithm scores your posts. Shares and comments matter far more than likes."
- Empty state: "Type or paste a draft post to analyze — we'll check for patterns the algorithm demotes and suggest improvements."
- Banner: "Post more to improve accuracy. Based on **14 posts** so far."
- Banner: "You always post at **Tue 9:00 AM**. Try varying your schedule to discover better times."
- Loading: "Analyzing your best posts…" / "Fetching post insights. Last update 30s ago."
- After-copy hint: "Copied! Paste into Threads to publish."

**Numbers and units:** `1.2K`, `2.31` (WES), `4.2%` (engagement rate), `Tue 9 AM` — always tabular-nums in tables for vertical alignment.

---

## Visual foundations

### Visual signatures

Every screen exhibits at least two of:

1. **Primitive shapes** — circles, triangles, squares, pills, squiggles as decorative background elements.
2. **Hard shadows** — solid offset drop shadows with **zero blur** (`4px 4px 0 0 #1E293B`). Sticker / cut-paper feel.
3. **Pattern fills** — polka dots, dashed outlines, diagonal stripes inside shapes or behind sections.
4. **Mixed radii** — fully rounded corners next to sharp ones for leaf/asymmetric blob shapes.

### Color

Light mode only. Background is `#FFFDF5` (warm cream — never pure white). Foreground is `#1E293B` (Slate 800 — softer than black). Card surfaces are `#FFFFFF`.

The **pop palette** rotates across decorative shapes, icon containers, emphasized words, and chart bands:

- `--accent` `#8B5CF6` Vivid Violet → **primary actions only** (buttons, links, active states, focus rings, chart-1)
- `--secondary` `#F472B6` Hot Pink → decorative pop, "featured" shadows, chart-2
- `--tertiary` `#FBBF24` Amber → decorative pop, warning bands, chart-3, outline-button hover fill
- `--quaternary` `#34D399` Mint → decorative pop, success bands, chart-4, "quality: great" state

Rule: never use all three decorative colors on the same element. Distribute them across a section to create a "confetti" effect — see the feature cards on the landing page (violet → pink → amber → mint → violet).

### Type

Two Google Fonts, four weights total:

- **Outfit** (700, 800) — all headings, logo wordmark, card titles, field labels. Geometric sans with rounded letterforms.
- **Plus Jakarta Sans** (400, 500, 600, 700) — all body, descriptions, table cells, button labels.

Scale: Major Third (1.25). Base `16px`. `16 → 20 → 25 → 31 → 39 → 49`.

Eyebrow/field labels: `11px`, weight 700, uppercase, `letter-spacing: 0.06em`, muted-foreground.

Tabular numerics on any numeric column or scoreline.

### Backgrounds, images, decoration

- Pages sit on `#FFFDF5` cream — **no full-bleed photography, no gradients on page backgrounds**.
- Hero / empty zones are filled with **floating decorations**: large soft-tinted circles (`bg-secondary/20`, `bg-primary/15`), dashed-bordered squares, small confetti dots in the pop palette, dot grids (`radial-gradient(circle, #E2E8F0 1.2px, transparent 1.2px)` at 14–20px spacing). Hidden on mobile.
- Where an illustration is needed (landing right-column), it's a **flat SVG mockup** of the product itself — colored chart bars, white card on dot-grid pattern clipped to a blob.
- One soft gradient is allowed inside a confined blob (`linear-gradient(135deg, tertiary, secondary)`). Never on page background, never behind text.

### Animation & motion

Every transitional CSS prop uses the same bouncy curve:

```
cubic-bezier(0.34, 1.56, 0.64, 1)   // overshoot, exposed as --ease-bounce
duration: 300ms                      // standard --duration
```

| Effect    | Behavior |
| --------- | -------- |
| Hover     | `translate(-2px,-2px)` paired with shadow stepping from default → hover (4 4 0 → 6 6 0) |
| Active    | `translate(2px,2px)` + shadow → 2 2 0 (press) |
| Card hover| `rotate(-1deg) scale(1.02)` — subtle wiggle |
| Entrance  | scale `0 → 1` with bounce, never plain fade |
| Marquee   | Infinite horizontal scroll for logo / keyword strips |
| Wiggle    | 0 → 3 → −3 → 0 deg on icon hover |

`prefers-reduced-motion` collapses all of the above to opacity fades or no animation.

### Hover, focus, press states

- **Buttons:** translate + shadow step (described above). Outline buttons fill with `tertiary` (#FBBF24) on hover. Ghost buttons fill with `muted`.
- **Cards (Sticker):** rotate(-1deg) scale(1.02) wiggle.
- **Inputs:** border → accent, shadow → `--shadow-accent` (`4px 4px 0 0 #8B5CF6`).
- **Focus rings:** `ring-3` (3px) of `--ring` (= accent) + matching hover shadow. Visible and chunky — never the default thin browser ring.
- **Table rows:** `bg-accent/5` on hover/expanded.

### Borders

Default border width is **2px**, everywhere. Chips, cards, inputs, buttons, banners — 2px solid `--foreground` (or `--input-border` `#CBD5E1` for inputs, which switches to accent on focus). Dashed 2px borders appear on placeholder/empty decorative shapes (e.g. the rotated square in the landing hero).

### Shadows

All shadows are hard (zero blur, solid offset). Five tokens:

```
--shadow-default:  4px 4px 0 0 #1E293B   /* resting depth */
--shadow-hover:    6px 6px 0 0 #1E293B   /* lift */
--shadow-active:   2px 2px 0 0 #1E293B   /* press */
--shadow-soft:     8px 8px 0 0 #E2E8F0   /* subtle card depth */
--shadow-featured: 8px 8px 0 0 #F472B6   /* pink highlight */
--shadow-accent:   4px 4px 0 0 #8B5CF6   /* focused input */
```

On mobile, each value is halved.

### Layout rules

- `max-w-6xl` (72rem) for dashboard content; `max-w-5xl` for the feature grid on the landing page.
- 12-column logic grouped into large blocks (6/6 or 4/4/4). Avoid single-column walls of text.
- Section padding `py-24` (96px) on the landing page; `py-6` to `py-10` inside dashboard cards.
- **Sticky header** at the top of the dashboard (`border-b-2 border-border`), full-width.
- **Left sidebar** (220-wide on desktop, 56-wide icon rail on tablet, bottom tab bar on mobile).
- Banner stack inside the content column, in order: token expiry → backfill → viral recovery. Non-negotiable.

### Transparency / blur

Transparency is used **sparingly and only on decorative shapes**: e.g. `bg-secondary/20`, `bg-primary/15`, `bg-tertiary/60` on the circle behind the H1. **No backdrop-blur, no glass-morphism, no frosted panels.** Content is always opaque on opaque.

### Corner radii

8 / 16 / 24 / full. Reserve `radius-full` (pill) for buttons, avatars, icon containers. Mixed radii (`rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-none`) create speech-bubble shapes.

### Cards

`StickerCard`: 2px black border, 24-radius, **soft shadow** (`8 8 0 #E2E8F0`) by default or **featured shadow** (`8 8 0 #F472B6`) when emphasized. Floating colored icon circle pinned half-out of the top-left border. Hover: rotate(-1deg) + 1.02 scale.

### Color vibe of imagery

There is no photography in Spool. All imagery is SVG: the brand color palette (violet, pink, amber, mint, slate) is **bright but not neon**, **warm but not muddy**. The cream paper background pulls everything back into a friendly register. Pinks and ambers carry the warmth; violet and mint balance with cool/cold; slate (foreground) anchors. The vibe is *risograph sticker book*, never glossy / cinematic / dark-mode.

---

## Iconography

Spool uses **Phosphor Icons** (`@phosphor-icons/react` in production; `@phosphor-icons/core` SVGs inlined in this kit) at stroke-width 2.5px, round caps, round joins. Two weights are used in product:

- `weight="regular"` for inactive nav items, secondary actions.
- `weight="fill"` for active nav items, primary callouts, icons inside `StickerCardIcon` colored circles.

**The signature rule: Phosphor icons are never floating alone.** They sit inside a colored circle — `bg-accent` / `bg-secondary` / `bg-tertiary` / `bg-quaternary` — with white (or slate on amber) icon color. Empty-state icons are 14×14 circle (`size-14`) with a 28-px glyph. Inline icons (`size-3.5` to `size-5`) appear inside button rows next to text.

Icons recurring across the product, by area:

- **Landing / features:** `ChartBar`, `Clock`, `Users`, `Lightning`, `PencilLine`
- **Header / nav:** `House`, `ChartBar`, `Users`, `SpeakerHigh`, `ClockCounterClockwise`, `Books`, `Lightbulb`, `Compass`, `MagnifyingGlass`, `PencilLine`, `Gear`, `SignOut`
- **Posts table:** `TextT`, `Image`, `VideoCamera`, `SquaresFour` (media-type pills), `CaretUp`, `CaretDown` (sort)
- **Scanner / composer:** `MagnifyingGlass`, `SpinnerGap`, `Article`, `Check`, `ArrowRight`, `Sparkle`, `Stop`, `WarningCircle`, `ClipboardText`, `ArrowsClockwise`, `Pencil`
- **Banner / progress:** `WarningCircle`, `SpinnerGap`, `Clock`, `TrendUp`, `Crosshair`, `Timer`, `UsersFour`, `FunnelSimple`

Unicode chars are used only inside copy (em-dashes ` — `, the dot ` · `, the right arrow `→` in dead-end-prevention CTAs like "Generate a better version →"). **No emoji.**

### CDN substitution

The UI kit renders **real Phosphor SVGs** — each icon is lazy-fetched from `unpkg.com/@phosphor-icons/core@2.1.1/assets/{regular|fill}/{slug}.svg` on first use and inlined as `<svg fill="currentColor">`. For production work, install `@phosphor-icons/react` and import per-glyph; the slugs map 1:1.

**Logos / brand assets:** the product itself does not ship a separate logomark — the Spool wordmark in Outfit Black is the logo. A simple yellow-circle-behind-the-S favicon variant lives in `assets/spool-mark.svg`.

---

## Files in this design system

```
README.md                  ← you are here
SKILL.md                   ← cross-compatible Agent Skill manifest
colors_and_type.css        ← drop-in CSS variables + base styles + Google Font imports
fonts/
  README.md                ← bundling instructions
  download.sh              ← self-host script for offline use
assets/
  spool-wordmark.svg       ← Outfit-800 "Spool" with the yellow-circle hero accent
  spool-mark.svg           ← 80x80 circular "S" mark for favicons / avatars
preview/                   ← per-token / per-component HTML cards (Design System tab)
  _shared.css
  colors-pop.html
  colors-neutrals.html
  colors-semantic.html
  type-display.html
  type-body.html
  radii.html
  shadows.html
  spacing.html
  buttons.html
  inputs.html
  cards.html
  icon-circles.html
  badges-chips.html
  progress-bar.html
  quality-gauge.html
  banners.html
  heatmap.html
  sidebar-nav.html
  logo.html
  decorations.html
ui_kits/web/               ← Spool Dashboard recreated as a click-thru prototype
  README.md
  index.html
  Shell.jsx                ← sidebar + header + theme toggle
  Sidebar.jsx
  Banners.jsx
  Landing.jsx
  Loading.jsx
  PostsScreen.jsx
  TimingScreen.jsx
  AudienceScreen.jsx
  VoiceScreen.jsx          ← brand-voice fingerprint, 11 dimensions × excerpts
  ScannerScreen.jsx
  ComposerScreen.jsx
  primitives.jsx           ← StickerCard, Button, Input, IconCircle, etc.
  icons.jsx                ← real Phosphor SVGs, lazy-fetched + cached
  app.jsx
```

## Quick start

Drop `colors_and_type.css` into your project and you have the full token surface and base type styles. Then look in `ui_kits/web/primitives.jsx` for the `StickerCard`, `CandyButton`, `Input`, `IconCircle`, and `Eyebrow` helpers used across the kit.

---

## Caveats

- **Fonts load via `@font-face` from `fonts.gstatic.com`** (matching what the codebase's `next/font/google` would self-host at build time). For truly offline bundling, run `bash fonts/download.sh` and uncomment the local `src:` lines in `colors_and_type.css`.
- **Light + dark mode.** Light is the codebase default; dark mode tokens are defined in this design system under `[data-theme="dark"]` and exposed via a theme toggle in the kit's header. The codebase has a `dark` Tailwind variant hook but no dark tokens shipped; if you adopt dark mode in production, port the tokens from `colors_and_type.css` into `globals.css`.
- **No real logo.** The brand is wordmark-only. The "S" mark in `assets/spool-mark.svg` is reconstructed from the landing-page hero treatment (yellow circle behind the headline).
