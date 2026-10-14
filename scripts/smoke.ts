// Live check against Luma's public discovery data. Prints counts only.
import { LumaDiscoveryClient } from '../src/index.js';

const client = new LumaDiscoveryClient();
const now = new Date();
const result = await client.searchNearby({
  latitude: 37.3382,
  longitude: -121.8863,
  startsAfter: now,
  startsBefore: new Date(now.getTime() + 7 * 86_400_000),
  limit: 50,
});
console.log(JSON.stringify({ events: result.events.length, pages: result.pagesFetched, sample: result.events.slice(0, 3).map((e) => [e.title, e.startsAt, e.venue?.city]) }));
const first = result.events[0];
if (first) {
  const detail = await client.getEvent(first.providerEventId);
  console.log(JSON.stringify({ detail: detail.title, descriptionChars: detail.description?.length ?? 0, categories: detail.categories }));
}
