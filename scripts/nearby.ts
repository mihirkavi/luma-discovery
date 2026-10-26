// Try it: list public Luma events near a coordinate for the next few days.
// Usage: npx tsx scripts/nearby.ts [latitude] [longitude] [days]
// Defaults to San Francisco and 3 days. Prints public event fields only.
import { LumaDiscoveryClient } from '../src/index.js';

const [lat = '37.7749', lng = '-122.4194', days = '3'] = process.argv.slice(2);
const now = new Date();
const luma = new LumaDiscoveryClient();
const { events, pagesFetched } = await luma.searchNearby({
  latitude: Number(lat),
  longitude: Number(lng),
  startsAfter: now,
  startsBefore: new Date(now.getTime() + Number(days) * 86_400_000),
  limit: 8,
});

// Emoji are dropped from the printed table only, so the columns line up in a terminal.
const plain = (text: string) => text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').trim();
const clip = (text: string, width: number) => {
  const value = plain(text);
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
};
for (const event of events) {
  const when = new Date(event.startsAt).toLocaleString('en-US', {
    timeZone: event.timezone ?? 'UTC',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  const price = event.price?.isFree ? 'free' : event.price?.text ?? 'paid';
  console.log(`${clip(when, 13)}  ${clip(event.title, 42)}  ${clip(event.venue?.city ?? 'online', 14)}  ${clip(price, 8)}  ${event.registration?.availability ?? 'unknown'}`);
}
console.log(`\n${events.length} events · ${pagesFetched} page(s) · guest lists stripped · register at each event's lu.ma URL`);
