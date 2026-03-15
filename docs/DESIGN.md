# DESIGN.md — Playful Geometric

> **Purpose**: This file is the single source of truth for all visual and interaction design decisions in this project. Reference it when implementing any UI component, page, or layout. It complements `CLAUDE.md` (coding conventions) and `PRD.md` (product requirements).

---

## Philosophy

**"Stable Grid, Wild Decoration."**

Content (text, forms, data) lives in clean, readable areas. Everything around it is alive with shape, color, and movement. The feeling is optimistic, tactile, and fun — a well-organized sticker book, not a corporate dashboard.

**References**: Memphis Group (1980s) cleaned up for modern screens. Remove the chaos, keep the energy.

**Keywords**: Friendly · Tactile · Pop · Energetic

---

## Visual Signatures

These are the defining traits of the system. Every screen should exhibit at least two:

1. **Primitive shapes** — circles, triangles, squares, pills, squiggles as decorative background elements, masks, or icon containers.
2. **Hard shadows** — solid offset drop shadows with zero blur, giving a sticker / cut-paper feel.
3. **Pattern fills** — polka dots, grid lines, diagonal stripes inside shapes or behind sections.
4. **Mixed radii** — fully rounded corners next to sharp ones to create leaf shapes and asymmetric blobs.

---

## Tokens

### Colors (Light Mode)

| Token              | Value     | Usage                                           |
| ------------------ | --------- | ----------------------------------------------- |
| `background`       | `#FFFDF5` | Page background (warm cream / paper feel)        |
| `foreground`       | `#1E293B` | Primary text (Slate 800, softer than pure black) |
| `muted`            | `#F1F5F9` | Subtle backgrounds (Slate 100)                   |
| `muted-foreground` | `#64748B` | Secondary text (Slate 500)                       |
| `accent`           | `#8B5CF6` | Primary actions and brand (Vivid Violet)         |
| `accent-foreground`| `#FFFFFF` | Text on accent backgrounds                       |
| `secondary`        | `#F472B6` | Decorative pop (Hot Pink)                        |
| `tertiary`         | `#FBBF24` | Decorative pop (Amber/Yellow)                    |
| `quaternary`       | `#34D399` | Decorative pop (Emerald/Mint)                    |
| `border`           | `#E2E8F0` | Default borders (Slate 200)                      |
| `input`            | `#FFFFFF` | Input backgrounds                                |
| `card`             | `#FFFFFF` | Card backgrounds                                 |
| `ring`             | `#8B5CF6` | Focus rings (matches accent)                     |

**Rules**:
- `accent` is for primary actions only — buttons, links, active states.
- `secondary`, `tertiary`, `quaternary` rotate across decorative shapes, icons, and emphasized words to create a "confetti" effect. Never use all three on the same element; distribute them across a section.

### Typography

| Role     | Family                              | Weights        | Notes                                  |
| -------- | ----------------------------------- | -------------- | -------------------------------------- |
| Headings | `"Outfit", system-ui, sans-serif`   | 700, 800       | Geometric sans with rounded letterforms |
| Body     | `"Plus Jakarta Sans", system-ui, sans-serif` | 400, 500 | Legible, geometric-humanist            |

**Scale ratio**: 1.25 (Major Third).

Example scale at `base: 16px`: 16 → 20 → 25 → 31.25 → 39 → 48.8

### Spacing

Use an 8px base grid. Standard section padding is `py-24` (96px). Generous but not empty — fill negative space with patterns and shapes.

### Radius

| Token         | Value    | When to use                                |
| ------------- | -------- | ------------------------------------------ |
| `radius-sm`   | `8px`    | Small elements (badges, chips)              |
| `radius-md`   | `16px`   | Inputs, small cards                         |
| `radius-lg`   | `24px`   | Large cards, modals                         |
| `radius-full` | `9999px` | Buttons (pill), avatar circles, icon circles |

**Blob radius** (speech-bubble): `rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-none`
**Arch radius**: `rounded-t-full rounded-b-none`

Default `border-width` is **2px** everywhere — chunky, visible, deliberate.

### Shadows

All shadows are **hard** — zero blur, solid offset.

| State    | Value                          | Purpose             |
| -------- | ------------------------------ | ------------------- |
| Default  | `4px 4px 0 0 #1E293B`         | Resting depth       |
| Hover    | `6px 6px 0 0 #1E293B`         | Lift (with translate)|
| Active   | `2px 2px 0 0 #1E293B`         | Press down           |
| Soft     | `8px 8px 0 0 #E2E8F0`         | Subtle card depth    |
| Featured | `8px 8px 0 0 #F472B6`         | Pink highlight shadow|

Hover/active states pair shadow changes with matching `translate` shifts so the element appears to physically lift or press.

---

## Components

### Buttons

**Primary ("Candy Button")**:
- Background: `accent`
- Text: white, weight 700
- Border: 2px solid `foreground`
- Radius: `radius-full` (pill)
- Shadow: default hard shadow
- Hover: translate(-2px, -2px), shadow → 6px 6px
- Active: translate(2px, 2px), shadow → 2px 2px
- Optional trailing icon: ArrowRight inside a white circle

**Secondary (Outline)**:
- Background: transparent
- Text: `foreground`
- Border: 2px solid `foreground`
- Radius: `radius-full`
- Shadow: none
- Hover: fills with `tertiary` (#FBBF24)

### Cards ("Sticker Card")

- Background: `card`
- Border: 2px solid `foreground`
- Radius: `radius-lg`
- Shadow: soft hard shadow (or featured pink shadow)
- Hover: rotate(-1deg) scale(1.02) — subtle wiggle
- Title: Outfit Bold
- Optional floating icon: a colored circle sitting half-in / half-out of the top border

### Inputs

- Background: `input`
- Border: 2px solid `#CBD5E1`
- Radius: `radius-md`
- Shadow (rest): 4px 4px 0 transparent (invisible)
- Focus: border → `accent`, shadow → 4px 4px 0 `accent`
- Label style: bold, uppercase, small size, `tracking-wide`

---

## Layout

**Container**: `max-w-6xl`, centered.
**Grid**: 12-column logic, grouped into large blocks (6/6 or 4/4/4). Avoid single-column walls of text.

### Section Patterns

| Section   | Layout                     | Decoration                                                         |
| --------- | -------------------------- | ------------------------------------------------------------------ |
| Hero      | Text left, image right     | Large yellow circle behind text; dotted pattern behind image; blob clip-path on image |
| Features  | 3-column card grid         | Dashed SVG connector lines between cards; alternating header colors (violet → pink → yellow) |
| Pricing   | 3-column, center enlarged  | Middle card at scale(1.1); rotated yellow star badge "MOST POPULAR" at 15deg |

---

## Motion & Animation

**Overall feel**: Bouncy, elastic, fun.

**Timing function**: `cubic-bezier(0.34, 1.56, 0.64, 1)` — overshoot/bounce on all `transition-all duration-300`.

| Effect    | Behavior                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Hover     | Translate + shadow shift with bounce easing                               |
| Entrance  | Scale 0 → 1 with bounce (pop in), not plain fade                         |
| Marquee   | Infinite horizontal scroll for logos or keyword strips                     |
| Wiggle    | Keyframe: 0deg → 3deg → -3deg → 0deg on icon hover                       |

**Reduced motion**: When `prefers-reduced-motion` is active, disable bounce, wiggle, and marquee. Fall back to simple opacity fades or no animation.

---

## Iconography

**Library**: Lucide React

| Property     | Value                                                |
| ------------ | ---------------------------------------------------- |
| Stroke width | `2.5px` (chunky)                                     |
| Line caps    | Round                                                 |
| Line joins   | Round                                                 |
| Presentation | Always enclosed in a colored circle — never floating alone. Example: a checkmark inside a green (#34D399) circle with white icon color. |

---

## Decorative Elements

These are the background shapes and textures that fill space and create the playful feel. They are **non-functional** — never block or interfere with content.

- **Dot grid**: repeating small dots in strict formation as a section background.
- **Squiggles**: SVG wavy paths used as section dividers or heading underlines.
- **Confetti shapes**: small absolutely-positioned SVG triangles and circles behind content blocks. Use `secondary`, `tertiary`, `quaternary` colors at low-to-mid opacity.
- **Pattern fills**: diagonal stripes or polka dots inside large decorative shapes.

Place decorative elements with `absolute` positioning inside a `relative` container. Use `z-index` to keep them behind interactive content. On mobile, hide complex floating shapes that risk overlapping text.

---

## Responsive Rules

| Breakpoint | Adjustments                                                        |
| ---------- | ------------------------------------------------------------------ |
| Mobile     | Stack all multi-column layouts to single column                     |
| Mobile     | Reduce hard shadows from 4–8px to 2px                               |
| Mobile     | Convert horizontal squiggle dividers to vertical                    |
| Mobile     | Minimum button/tap-target height: 48px                              |
| Mobile     | Hide complex background floating shapes that overlap text           |
| Desktop    | Full decorative treatment — shapes, patterns, full shadow depth     |

---

## Accessibility

| Concern     | Rule                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| Contrast    | Slate 800 on cream/white = AAA. Always verify accent-on-white combinations. |
| Color-only  | Never use color alone to convey meaning. Pair with shape + text label.       |
| Motion      | Respect `prefers-reduced-motion`. Disable bounce, wiggle, marquee.           |
| Focus       | Thick colored border + hard shadow. Must be visually obvious.                |
| Touch       | Minimum 48px tap targets on mobile.                                          |
