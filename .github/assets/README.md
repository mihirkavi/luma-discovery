# README assets

Images used by the repository's root `README.md`.

| File | What it is | How it was made |
| --- | --- | --- |
| `banner-light.png`, `banner-dark.png` | The README banner for light and dark GitHub themes: a map with search-radius rings and pins labelled with real registration states | Rendered from `source/banner.html` with headless Chromium (1600×600 at 2×, 3200×1200). See `source/README.md` |
| `terminal.png` | The hero image: a terminal card of `npx tsx scripts/nearby.ts 37.7749 -122.4194 3` | Real output from a live run against Luma's public data on 26 October 2026, rendered as a card with headless Chromium. Output was not edited. |

## Visual identity

- **Type:** Bricolage Grotesque for display, JetBrains Mono for labels and code.
- **Colours:** coral `#ff5a3c`, amber `#ffb020`, plum `#5a2a7e`, ink `#1d1424`, cream `#fff6ec` (dark: `#170f1d` background).
- **Motif:** a map with search-radius rings around the demo coordinates and pins labelled with the record's registration states.
- **Family:** a sibling of [structured-event-feeds](https://github.com/mihirkavi/structured-event-feeds), which shares the type families with a condensed width, a teal palette and a calendar motif. Luma's own branding is deliberately not used; this is not an official Luma project.
- Badges use the same hex colours.

Notes for agents and contributors:

- Screenshots and terminal cards must show only public data or synthetic demo data. Never show attendee names, accounts, tokens or private calendars.
- Re-run the command and re-render the card instead of editing the image by hand. Keep the date in the README caption accurate.
