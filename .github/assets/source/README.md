# Banner source

`banner.html` is the editable source of the README banner (`../banner-light.png` and `../banner-dark.png`). One file holds both themes: the dark palette sits under `@media (prefers-color-scheme: dark)`.

Identity: Bricolage Grotesque (display) and JetBrains Mono (labels); coral `#ff5a3c`, amber `#ffb020`, plum `#5a2a7e`, ink `#1d1424` and cream `#fff6ec`. The motif is a map with search-radius rings and pins labelled with the library's real registration states. It is a sibling of structured-event-feeds and deliberately does not copy Luma's own branding.

## Re-render

Use any headless Chromium at a 1600×600 viewport and device scale factor 2 (the published PNGs are 3200×1200). With a small Playwright renderer such as `render-html.mjs` (not included in this repository), run from `.github/assets/`:

```bash
node render-html.mjs source/banner.html banner-light.png --scheme light
node render-html.mjs source/banner.html banner-dark.png --scheme dark
```

Without that script, open the file in Chromium or Playwright, emulate `prefers-color-scheme`, wait for web fonts to load and take a 1600×600 screenshot at 2× scale.

Notes for agents and contributors:

- Fonts load from Google Fonts, so rendering needs network access.
- Keep every label on the banner true to the code. It must not show personal data, real accounts, tokens or invented output.
- View both PNGs after rendering and check for overflow and weak contrast.
