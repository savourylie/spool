# [TICKET-021] Responsive & Accessibility Pass

## Status
`blocked`

## Dependencies
- Requires: #012 ✅, #013 ✅, #014, #015, #016, #017, #018, #019, #020

## Description
Comprehensive pass across all pages and components to ensure DESIGN.md responsive rules are followed and accessibility requirements are met. This is a dedicated sweep — not incremental fixes.

## Acceptance Criteria
- [ ] **Mobile**: all multi-column layouts stack to single column
- [ ] **Mobile**: hard shadows reduced from 4–8px to 2px
- [ ] **Mobile**: horizontal squiggle dividers converted to vertical
- [ ] **Mobile**: minimum button/tap-target height of 48px
- [ ] **Mobile**: complex background floating shapes hidden (no text overlap)
- [ ] **Desktop**: full decorative treatment — shapes, patterns, full shadow depth
- [ ] **Contrast**: Slate 800 on cream/white verified as AAA
- [ ] **Contrast**: accent-on-white combinations verified (add dark text if needed)
- [ ] **Color-only**: no information conveyed by color alone — paired with shape + text label
- [ ] **Motion**: `prefers-reduced-motion` disables bounce, wiggle, marquee; falls back to opacity fades or no animation
- [ ] **Focus**: thick colored border + hard shadow on all interactive elements — visually obvious
- [ ] **Touch**: all tap targets minimum 48px on mobile
- [ ] **Keyboard**: all interactive elements reachable and operable via keyboard
- [ ] **Screen reader**: semantic HTML, proper heading hierarchy, ARIA labels on charts/icons
- [ ] **Charts**: all charts have text alternatives (summary text, table fallback, or ARIA descriptions)
- [ ] Post table is horizontally scrollable on mobile (not clipped)

## Design Reference
- **Responsive**: § Responsive Rules (all breakpoint adjustments)
- **Accessibility**: § Accessibility (contrast, color-only, motion, focus, touch)
- **Shadows**: § Tokens > Shadows (reduced on mobile)
- **Decorative**: § Decorative Elements (hide on mobile when overlapping)

## Implementation Notes
- Key files: various components, `globals.css`, Tailwind responsive utilities
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) for breakpoint adjustments
- Shadow reduction on mobile: create `shadow-hard-sm` variant for mobile and apply conditionally
- Test with browser DevTools device emulation and real devices if possible
- Use axe-core or Lighthouse accessibility audit to catch issues
- Charts: add `role="img"` and `aria-label` with text summary

## Testing
- Test all pages at 375px (iPhone SE), 768px (iPad), and 1280px+ (desktop) widths
- Run Lighthouse accessibility audit on each page — target score ≥ 90
- Tab through entire dashboard with keyboard — verify all elements reachable
- Enable `prefers-reduced-motion` in browser → verify animations disabled
- Test with VoiceOver (macOS) or NVDA (Windows) on key flows
- Verify no color-only information (e.g., heatmap has tooltips, not just color)
