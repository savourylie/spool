# [TICKET-012] Landing Page

## Status
`pending`

## Dependencies
- Requires: #003 ✅

## Description
Build the public landing page at `/` that introduces Spool and provides the "Connect Threads" CTA. Follows the DESIGN.md Hero section pattern with playful geometric decorations, the Candy Button CTA, and feature highlights.

## Acceptance Criteria
- [ ] Landing page renders at `/`
- [ ] Hero section: text left, image/illustration right layout
- [ ] Hero heading in Outfit 800 with a large yellow circle decorative element behind it
- [ ] Hero subtext explains Spool's value proposition (from PRD: "Connect your Threads account. See what's working, when to post, and who's listening.")
- [ ] Primary CTA: "Connect Threads" Candy Button with ArrowRight icon → links to OAuth flow (#004)
- [ ] Dot-grid pattern fills background behind hero image area
- [ ] Image area uses blob clip-path for playful shape
- [ ] Features section: 3-column card grid highlighting the 3 MVP features (Post Performance, Best Time, Audience)
- [ ] Feature cards use Sticker Card component with alternating header accent colors (violet → pink → yellow)
- [ ] Dashed SVG connector lines between feature cards (per DESIGN.md)
- [ ] Page uses warm cream background (`#FFFDF5`)
- [ ] All decorative elements use absolute positioning behind content (z-index layered)

## Design Reference
- **Layout**: § Layout > Section Patterns > Hero (text left, image right, yellow circle, dot-grid, blob clip)
- **Layout**: § Layout > Section Patterns > Features (3-column cards, dashed connectors, alternating colors)
- **Components**: § Components > Buttons > Primary (Candy Button for CTA)
- **Components**: § Components > Cards > Sticker Card (feature cards)
- **Decorative**: § Decorative Elements (dot grid, confetti shapes, squiggles)

## Visual Reference
The landing page hero section is visible at `/`. Left side shows the heading "Spool" in Outfit 800 with a yellow circle behind it and a subheading in Plus Jakarta Sans. A primary "Connect Threads" Candy Button with ArrowRight icon sits below. Right side shows a placeholder dashboard illustration with blob clip-path. A dot-grid pattern fills the background. Below the hero, three Sticker Cards in a row show the three features with alternating violet/pink/yellow accents and Lucide icons in colored circles. Dashed SVG lines connect the cards.

## Implementation Notes
- Key files: `app/page.tsx`
- Hero illustration: use a placeholder image or SVG for now — can be replaced later
- Blob clip-path: `clip-path: path(...)` or use CSS `border-radius` blob technique
- Feature icons: use Lucide React (e.g., BarChart3 for posts, Clock for timing, Users for audience)
- On mobile: stack hero to single column, hide complex floating shapes per DESIGN.md responsive rules
- If user is already authenticated, consider redirecting to `/dashboard`

## Testing
- Run `npm run dev` → navigate to `/`
- Verify hero layout with text left, image right
- Verify yellow circle decoration, dot-grid pattern, blob clip-path
- Verify "Connect Threads" button uses Candy Button styling with hover/active states
- Verify 3 feature cards with alternating accent colors
- Verify mobile responsive: stacks to single column, decorations hidden
