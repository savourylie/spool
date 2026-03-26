# [TICKET-048] Dashboard Sidebar Component

## Status
`done`

## Dependencies
- Requires: None

## Description
Create a new `DashboardSidebar` component that replaces the existing `DashboardTabs` horizontal tab bar and `DashboardHeader`. The sidebar provides grouped navigation (Today / Understand / Insights / Create) with section labels, active state tracking, and responsive collapse behavior. This is the foundational UI change for the v2 redesign.

## Acceptance Criteria
- [x] `DashboardSidebar` component created at `src/components/dashboard/dashboard-sidebar.tsx`
- [x] Sidebar is 240px wide with vertical layout, using existing `--sidebar-*` CSS variables from `globals.css:47-55`
- [x] Header section shows "Spool" logo (Plus Jakarta Sans 800) and `@username`
- [x] Navigation items grouped under section labels: UNDERSTAND (Performance, Audience), INSIGHTS (Topics & Patterns), CREATE (Discover, Scanner, Compose), plus standalone "Today" at top
- [x] Active nav item uses `--sidebar-accent` background with `--sidebar-accent-foreground` text and `--primary` icon color
- [x] Inactive items use `--sidebar-foreground` color with hover state
- [x] Active state tracked via `usePathname()` from `next/navigation`
- [x] Footer section shows sign-out button with `SignOut` Phosphor icon
- [x] Sign-out triggers existing sign-out logic (same as current `DashboardHeader`)
- [x] Sidebar border-right using `--sidebar-border`

## Design Reference
- **Mockup**: Pencil file — Screen 1 "Dashboard Shell + Sidebar"
- **Colors**: `globals.css` lines 47-55 (sidebar CSS variables)
- **Icons**: Phosphor — House, ChartBar, Users, Lightbulb, Compass, MagnifyingGlass, PencilLine, SignOut

## Visual Reference
A 240px-wide left sidebar on warm cream background. Top: "Spool" in violet bold + "@username" in muted gray. Below: nav items with Phosphor icons, grouped under uppercase 11px section labels (UNDERSTAND, INSIGHTS, CREATE). The active item has a light violet background with rounded corners. Bottom: "Sign out" with icon.

## Implementation Notes
- Key files: Create `src/components/dashboard/dashboard-sidebar.tsx`
- Reuse sign-out logic from `src/components/dashboard/dashboard-header.tsx`
- Use Phosphor icons (`@phosphor-icons/react`) matching the existing app convention
- Nav items should be `<Link>` components for client-side navigation
- Consider using `startsWith` for pathname matching (e.g., `/dashboard/understand` matches `/dashboard/understand/audience`)

## Testing
- `npm run dev` — sidebar renders on any `/dashboard/*` route
- Active state correctly highlights based on current URL
- Sign-out button works
- Visual check matches Pencil mockup
