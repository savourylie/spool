# Fonts

Spool uses **Outfit** (700, 800) for headings and **Plus Jakarta Sans** (400, 500, 600, 700) for body — both from Google Fonts.

## How they're loaded today

`colors_and_type.css` declares explicit `@font-face` rules that reference Google's font CDN at `fonts.gstatic.com` directly. This pins the version of each face and avoids the extra round-trip through `fonts.googleapis.com/css2`. It works in any modern browser as long as it can reach Google's CDN.

## Truly local bundling

If you need this design system to work offline or you'd prefer to self-host the binaries:

```bash
bash fonts/download.sh
```

The script downloads each WOFF2 into this folder. After it finishes, open `colors_and_type.css` and switch the commented `/* local first */` `src: url("fonts/…")` lines on (and the gstatic ones off). The cascade is:

```
@font-face {
  font-family: "Outfit";
  font-weight: 800;
  font-display: swap;
  /* local first */
  /* src: url("fonts/Outfit-800.woff2") format("woff2"); */
  src: url("https://fonts.gstatic.com/...") format("woff2");
}
```

## Production / Next.js

The original codebase uses `next/font/google` which downloads and self-hosts at build time — see `spool/src/app/layout.tsx`. If you're inside that app, do not change `layout.tsx`; `next/font` already handles everything.
