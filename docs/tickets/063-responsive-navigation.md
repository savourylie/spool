# [TICKET-063] Responsive Mobile Navigation

## Status
`pending`

## Dependencies
- Requires: #048 ✅

## Description
Add responsive behavior to the `DashboardSidebar`: a bottom tab bar on mobile (<768px), an icon-only rail on tablet (768-1024px), and the full sidebar on desktop (>1024px). The bottom tab bar shows 4 section icons (Today, Understand, Insights, Create) with tapping a section that has sub-pages opening a slide-up sheet for sub-navigation.

## Acceptance Criteria
- [ ] Desktop (>1024px): Full 240px sidebar with icons, labels, and section groups (current behavior)
- [ ] Tablet (768-1024px): Collapsed icon-only rail (56px wide) with tooltips on hover
- [ ] Mobile (<768px): Sidebar hidden, bottom tab bar with 4 icons: House (Today), ChartBar (Understand), Lightbulb (Insights), PencilLine (Create)
- [ ] Mobile: tapping "Understand" or "Create" (sections with sub-pages) opens a slide-up sheet with sub-navigation options
- [ ] Mobile: tapping "Today" or "Insights" (single pages) navigates directly
- [ ] Active section highlighted in tab bar
- [ ] Tab bar uses fixed position at bottom, safe area inset for notched devices
- [ ] Slide-up sheet uses Framer Motion `AnimatePresence` with `useDragControls` for swipe-to-dismiss
- [ ] Content area adjusts width for each breakpoint

## Implementation Notes
- Key file: `src/components/dashboard/dashboard-sidebar.tsx` (extend), create `src/components/dashboard/mobile-tab-bar.tsx`
- Use Tailwind responsive classes: `hidden lg:flex` for sidebar, `lg:hidden` for tab bar
- Slide-up sheet: simple overlay with white card sliding from bottom
- Consider using `useMediaQuery` or CSS-only approach for breakpoint detection
- Tab bar height: 64px + safe-area-inset-bottom

## Testing
- Resize browser to each breakpoint, verify correct navigation mode
- Mobile: tap each tab icon, verify navigation
- Mobile: tap "Understand", verify sub-nav sheet appears with Performance and Audience options
- Tablet: hover over icons, verify tooltips
- No layout shifts between breakpoints
