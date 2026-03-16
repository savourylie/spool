# [TICKET-003] Shared UI Components

## Status
`pending`

## Dependencies
- Requires: #001 ✅
  - Design tokens in `src/app/globals.css`: colors (`bg-accent`, `bg-secondary`, `bg-tertiary`, `bg-quaternary`), shadows (`shadow-default`, `shadow-hover`, `shadow-active`), radii (`rounded-sm`=8px, `rounded-md`=16px, `rounded-lg`=24px), easing (`ease-bounce`)
  - `cn()` utility at `src/lib/utils.ts` for conditional class merging
  - shadcn Button primitive at `src/components/ui/button.tsx` — override styles to match DESIGN.md Candy Button / Outline specs
  - **Icon library is Phosphor** (`@phosphor-icons/react`), not Lucide — update references in implementation notes accordingly

## Description
Build the reusable UI component library based on DESIGN.md specifications: Candy Button (primary), Outline Button (secondary), Sticker Card, and styled Input. These components are used across the landing page, dashboard, and backfill progress screens.

## Acceptance Criteria
- [ ] Primary "Candy Button" component: pill shape, accent background, white text, 2px border, hard shadow, hover lift (-2px translate + 6px shadow), active press (2px translate + 2px shadow), bounce easing
- [ ] Optional trailing icon variant (ArrowRight in white circle)
- [ ] Secondary "Outline Button" component: transparent background, 2px border, no shadow, hover fills with tertiary (#FBBF24)
- [ ] "Sticker Card" component: white background, 2px border, radius-lg, soft hard shadow, hover wiggle (rotate -1deg, scale 1.02), Outfit Bold title
- [ ] Optional floating icon variant (colored circle half-in/half-out of top border)
- [ ] Styled Input component: white background, 2px border (#CBD5E1), radius-md, focus state (accent border + accent shadow), bold uppercase small label
- [ ] All components respect `prefers-reduced-motion` (disable bounce, wiggle)
- [ ] All components use design tokens from #001 (no hardcoded colors)
- [ ] All components have proper focus states with thick colored border + hard shadow (per DESIGN.md accessibility)

## Design Reference
- **Components**: § Components > Buttons (Candy Button, Outline), Cards (Sticker Card), Inputs
- **Shadows**: § Tokens > Shadows (default, hover, active, soft, featured)
- **Motion**: § Motion & Animation (bounce easing, wiggle keyframe)
- **Accessibility**: § Accessibility (focus states, touch targets)

## Visual Reference
A `/dev` or storybook-style page showing all component variants: primary button (default, hover, active, disabled), secondary button (default, hover), card (default, hover, with floating icon), input (default, focus, with label). Each component demonstrates the hard shadow and bounce animation on interaction.

## Implementation Notes
- Key files: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`
- Build on top of shadcn/ui primitives — override styles to match DESIGN.md
- Wiggle keyframe: `0deg → 3deg → -3deg → 0deg` on card hover
- Minimum touch target: 48px on mobile per DESIGN.md accessibility rules
- Icons use Lucide React with `strokeWidth={2.5}`, round caps/joins, always inside colored circles

## Testing
- Run `npm run dev` and visually verify each component variant
- Test hover, active, and focus states on buttons
- Test card hover wiggle animation
- Test input focus state (accent border + shadow appears)
- Verify reduced motion: disable animations when `prefers-reduced-motion` is active
