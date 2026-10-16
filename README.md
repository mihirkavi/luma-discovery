# luma-discovery

Read-only discovery of public [Luma](https://lu.ma) events for AI agents and apps. Search events near a place, get public details for one event, and get results in a small, provider-neutral *open event record* that other adapters share.

It exists because the official Luma integrations don't cover this case. Luma's documented API is for organizers managing their own calendars and needs Luma Plus. Assistant-side Luma connectors can't be called from your own backend. This package lets a backend or a local agent run the same public discovery that signed-out visitors on lu.ma see.

Part of [Open Media Events](https://github.com/mihirkavi/open-media/tree/main/docs/events), but usable on its own.

## What it does

- `searchNearby({ latitude, longitude, startsAfter, startsBefore, limit })`: public events near a coordinate, filtered to a time window, with pagination.
- `getEvent(idOrUrl)`: public details for one event, including plain-text description and categories. Accepts an `evt-…` id, a `lu.ma` URL, or a slug.
- Each result has the title, start and end times, timezone, venue and coordinates, organizer (calendar name), price, registration availability, approval requirement, spots remaining, recurrence and aggregate guest count.
- A stdio MCP server (`luma_search_nearby`, `luma_get_event`) for Claude, Codex and other MCP clients.

## What it deliberately does not do

- **No registration, sign-in or account actions.** Results include the official event URL so a person can register there.
- **No attendee data.** Guest lists, featured guests and their social handles are dropped during normalization. Only the aggregate count is kept.
- **Not an official API.** It reads `api.lu.ma` JSON endpoints that power Luma's public website. They are undocumented and can change without notice. Luma's robots.txt does not disallow them. Keep request volume modest and cache results.

## Use

Requires Node 22.13+ or any bundler that compiles TypeScript (Wrangler, Vite, esbuild). The package ships TypeScript source.

```bash
npm install github:mihirkavi/luma-discovery
```

```ts
import { LumaDiscoveryClient } from 'luma-discovery';

const luma = new LumaDiscoveryClient();
const { events } = await luma.searchNearby({
  latitude: 37.3382,
  longitude: -121.8863,
  startsAfter: new Date(),
  startsBefore: new Date(Date.now() + 7 * 86_400_000),
});
```

### MCP server

```bash
git clone https://github.com/mihirkavi/luma-discovery && cd luma-discovery && npm install
npm run mcp   # stdio transport
```

Claude Code example: `claude mcp add luma-discovery -- npx tsx /path/to/luma-discovery/src/mcp.ts`

## Project structure

```
src/
├── index.ts    # LumaDiscoveryClient and normalization to open event records
├── types.ts    # open event record types
└── mcp.ts      # stdio MCP server
test/           # unit tests with recorded-shape fixtures
scripts/smoke.ts  # live smoke check
```

## Development

```bash
npm test         # unit tests with recorded-shape fixtures (no network)
npm run typecheck
npm run smoke    # live check against Luma (prints counts and titles only)
```

## Status

v0.1. Verified live on 2026-10-13 against Bay Area searches. Known limits: there is no keyword search (filter results yourself), and the endpoint shape may change.

## License

MIT
