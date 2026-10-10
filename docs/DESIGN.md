# DESIGN.md — Editorial Utility

> **Purpose**: Single source of truth for all visual and interaction design in this project. Reference it when implementing any UI component, page, or layout. It complements `CLAUDE.md` (coding conventions) and `PRD.md` (product requirements).
>
> **Supersedes** the original "Playful Geometric" system. The full design-tool handoff bundle this was derived from lives in `docs/design-system-v2/` (HTML spec + `system.css` + screenshots). Live tokens are in `src/app/globals.css`.

---

## Philosophy

**"Editorial Utility."**

A quiet, architectural system for reading the algorithm. One typeface in several weights, paper-and-ink contrast, monospace where structure matters, and a single muted accent that gets out of the way. Sharp corners, hairline borders, tabular by default. Content does the talking; chrome recedes.

**References**: editorial/utilitarian interfaces — text-first hierarchy, restrained color, generous structure.

**Keywords**: Minimal · Architectural · Monochrome · Precise

---

## Visual Signatures

Defining traits of the system:

1. **Paper + ink** — warm near-white surfaces, near-black text, no decorative color fills.
2. **Hairlines, not shadows** — elevation is communicated by 1px lines and tone, not lift.
3. **Mono for structure** — Geist Mono carries eyebrows, labels, badges, timestamps, and tabular numerals.
4. **Sharp corners** — 2–8px radii; pill radius reserved for avatars and selection chips only.
5. **One accent** — a single muted ink-blue for links, focus rings, active tints — never decorative fills.

---

## Tokens

The system defines a small **source palette** (paper / ink / one accent / semantics); existing semantic names (`background`, `primary`, `muted`, …) are aliased to it. Dark mode overrides only the source palette, so every alias follows automatically. See `src/app/globals.css`.

### Colors (Light Mode)

| Token              | Value     | Usage                                            |
| ------------------ | --------- | ------------------------------------------------ |
| `background` / `--paper`   | `#fafaf7` | Page background (warm near-white)        |
| `--paper-2`        | `#f3f2ed` | Sunken / muted blocks (`muted`)                  |
| `--paper-3`        | `#ebeae3` | Zebra rows, meter tracks                         |
| `card`             | `#ffffff` | Lifted card surface                              |
| `foreground` / `--ink`     | `#0a0a09` | Primary text; **primary actions** (ink) |
| `--ink-2`          | `#3a3a36` | Secondary text                                   |
| `muted-foreground` / `--ink-3` | `#6e6e66` | Tertiary / meta                          |
| `--ink-4`          | `#a8a89e` | Placeholders, dim labels                         |
| `border` / `--line`        | `#e6e4dd` | Default hairline                         |
| `--line-strong`    | `#c9c7be` | Hover / emphasis hairline; input resting border  |
| `accent` / `ring`  | `#2a4cf0` | Links, focus rings, active tints **only**        |
| `--accent-soft`    | `#e6eafe` | Selection / focus halo                           |
| `pos` / `quaternary` | `#2f7a4f` | Positive / success / "great"                   |
| `neg` / `destructive` | `#b8392d` | Negative / destructive                        |
| `warn` / `tertiary` | `#8a6b16` | Warning                                         |

**Rules**:
- `primary` is **ink**; primary buttons are ink on paper.
- `accent` (ink-blue) is reserved for links, focus, active states, and faint tints (`bg-accent/5`). Never a decorative fill.
- Semantic `pos`/`neg`/`warn` (each with a `-soft` tint) appear only inside data and banners. The former "confetti" pop palette is retired — `secondary`/`tertiary`/`quaternary` are remapped to neutral/semantic values for backwards compatibility.

### Typography

| Role        | Family                                  | Weights      | Notes                                  |
| ----------- | --------------------------------------- | ------------ | -------------------------------------- |
| Sans (all)  | `"Geist", ui-sans-serif, system-ui`     | 300–700      | Headings use weight **500** + tight negative tracking |
| Mono        | `"Geist Mono", ui-monospace`            | 400–600      | Eyebrows, labels, badges, timestamps, tabular numerals |

Loaded via `next/font/google` in `src/app/layout.tsx`. Headings are weight 500 (sharp, not heavy), `letter-spacing: -0.02em`. Eyebrow/label = mono, 11px, uppercase, `letter-spacing: 0.08em`, `ink-3` (use the `.eyebrow` helper). Numeric columns use `tabular-nums`.

### Spacing

A 4px ramp: `4 8 12 16 20 24 32 40 56 80`. Density tokens (`--row-h`, `--field-h`, `--pad-y`) default to "regular"; `[data-density]` hooks exist for compact/comfy.

### Radius

| Token         | Value    | When to use                                   |
| ------------- | -------- | --------------------------------------------- |
| `radius-sm`   | `4px`    | Buttons, inputs, badges, most elements        |
| `radius-md`   | `6px`    | Cards-as-panels, tooltips                     |
| `radius-lg`   | `8px`    | Large cards / surfaces                        |
| pill          | `9999px` | Avatars and **selection chips only**          |

Default `border-width` is **1px** (hairline) everywhere.

### Lines & Shadows

Elevation comes from hairlines, not lift. There are no hard drop shadows.

| Token             | Value                                   | Purpose                          |
| ----------------- | --------------------------------------- | -------------------------------- |
| `--shadow-soft`   | `0 1px 0 0 var(--line)`                 | Faint surface seam               |
| `--shadow-default`| barely-there ink wash                   | Rare, subtle depth               |
| `--shadow-accent` | `0 0 0 3px var(--accent-soft)`          | Focused-input halo               |
| `--line` / `--line-strong` | 1px hairlines                  | Default / hover-emphasis borders |

---

## Components

### Buttons

One sharp shape (`radius-sm`); the accent appears only in the focus ring (`outline` 2px `accent`, offset 2px).

- **Primary (`candy`)**: ink background, paper text, 1px ink border; hover darkens slightly. No shadow.
- **Secondary (`outline`)**: transparent, 1px `line-strong` border, ink text; hover → ink border + `paper-2`.
- **Ghost**: transparent, `ink-2` text; hover `paper-2`.
- **Destructive**: transparent, `neg` text + soft border; hover `neg-soft`.
- Sizes: `sm` 28px · `default` 36px · `lg` 44px · `icon` square.

### Cards

Flat: `card` background, 1px `border` hairline, `radius-lg`, **no shadow, no hover transform**. Emphasis comes from internal hierarchy — eyebrow → title → body — not from a colored border or icon circle. `featured` swaps the border to ink. (The former floating "sticker" icon circle is removed.)

### Inputs

`card` background, 1px `line-strong` border, `radius-sm`, 36px tall. Focus is the only place the accent appears: `accent` border + 3px `accent-soft` halo (`--shadow-accent`). Field labels are quiet sentence-case (`ink-2`); use a mono eyebrow where structure needs calling out.

### Badges

Mono, uppercase, tracked tags at `radius-sm` — never colored pills. Semantic tone via `*-soft` background + matching text color (e.g. `bg-pos-soft text-pos`).

### Avatars

Mono initials on `paper-3`, pill (round) for people, `radius-sm` square for brand/project entities.

---

## Layout

**Container**: `max-w-7xl`, centered. **Shell**: left sidebar (Studio / Tools / Library sections) + content. **Active nav** = a filled ink rectangle (`bg-foreground text-background`); **tabs** use a 2px ink underline — never both styles in one row.

**Screen header** (`ScreenHead`): mono eyebrow → tight-tracked title → optional right-aligned actions, sitting on a hairline.

---

## Motion & Animation

**Overall feel**: quiet and quick.

**Timing function**: `cubic-bezier(0.4, 0, 0.2, 1)` (exposed as `--ease-bounce` for backwards-compat). Typical duration 140ms; transitions animate color/border/box-shadow, not transform.

No bounce, no wiggle, no scale-pop. Entrances are simple fades or instant. **Reduced motion**: `prefers-reduced-motion` collapses transitions to ~0.

---

## Iconography

**Library**: Phosphor (`@phosphor-icons/react`), **regular** weight, ~18px. Icons are line glyphs that sit **inline** (next to titles, in nav, in buttons) — never enclosed in a colored circle. Where a glyph needs a container (empty states, section headers), use a neutral `radius-sm` `paper-2` tile with an `ink-3` icon. No fill weights as a rule; emphasis comes from grouping.

---

## Charts

Monochrome. Recharts series use the ink ramp `--chart-1..5` (`ink → accent → ink-3 → ink-4 → line-strong`). Heatmaps interpolate `color-mix(in oklab, var(--ink) t%, var(--paper-2))`. A single accent-blue bar/point may mark a highlight. Tooltips are hairlined `popover` panels in mono.

---

## Dark mode

Enabled via `next-themes` (`class` strategy; `.dark` on `<html>`). Only the ~20 source-palette tokens are overridden in `.dark` (paper `#0c0c0b`, ink `#f6f5ef`, accent `#7d96ff`, lines `#26251f`/`#3a3933`, plus dark semantics); all semantic aliases follow automatically. Foregrounds that sit on themed colored backgrounds use `var(--paper)`, which is always the opposite of `--ink` across themes. A sun/moon toggle lives in the sidebar footer.

---

## Responsive Rules

| Breakpoint | Adjustments                                                       |
| ---------- | ----------------------------------------------------------------- |
| Mobile     | Stack multi-column layouts to single column                        |
| Mobile     | Left sidebar → bottom tab bar (Overview / Studio / Tools / Library) with slide-up sheets |
| Tablet     | Sidebar collapses to a 56px icon rail with hairline tooltips        |
| Mobile     | Minimum button/tap-target height: comfortable (≥44px where touched) |
| Desktop    | Full sidebar + multi-column content                                 |

---

## Accessibility

| Concern     | Rule                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Contrast    | Ink on paper is high-contrast in both themes. Verify accent and `*-soft` pairings. |
| Color-only  | Never use color alone to convey meaning. Pair with mono label + icon.         |
| Motion      | Respect `prefers-reduced-motion`. No bounce/wiggle to begin with.             |
| Focus       | Accent outline (2px, offset 2px) on controls; accent border + soft halo on inputs. Always visible. |
| Touch       | Comfortable tap targets on mobile.                                            |
