import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LumaDiscoveryClient, normalizeEntry, proseMirrorText } from '../src/index.js';

const entry = {
  api_id: 'evt-abc123',
  event: {
    api_id: 'evt-abc123',
    name: ' Founders Dinner ',
    start_at: '2026-10-16T02:00:00.000Z',
    end_at: '2026-10-16T04:00:00.000Z',
    timezone: 'America/Los_Angeles',
    url: 'founders-dinner',
    location_type: 'offline',
    recurrence_id: null,
    waitlist_status: 'disabled',
    geo_address_info: { city: 'Palo Alto', region: 'California', country: 'United States', address: 'Cafe', full_address: '1 University Ave, Palo Alto, CA' },
    coordinate: { latitude: 37.44, longitude: -122.16 },
  },
  calendar: { api_id: 'cal-1', name: 'Builders Club', slug: 'builders', is_personal: false },
  hosts: [{ name: 'Host One' }],
  guest_count: 40,
  ticket_info: { price: null, is_free: true, max_price: null, is_sold_out: false, spots_remaining: 5, require_approval: true },
  registration_availability: 'open',
  featured_guests: [{ name: 'Private Person', linkedin_handle: '/in/private' }],
};

test('normalizes a discovery entry without exposing guests', () => {
  const event = normalizeEntry(entry, '2026-10-13T00:00:00.000Z');
  assert.ok(event);
  assert.equal(event.title, 'Founders Dinner');
  assert.equal(event.url, 'https://lu.ma/founders-dinner');
  assert.equal(event.attendanceMode, 'in_person');
  assert.equal(event.organizer?.name, 'Builders Club');
  assert.equal(event.registration?.availability, 'approval_required');
  assert.equal(event.registration?.spotsRemaining, 5);
  assert.equal(event.venue?.city, 'Palo Alto');
  assert.equal(event.attendeeCount, 40);
  assert.ok(!JSON.stringify(event).includes('Private Person'));
  assert.ok(!JSON.stringify(event).includes('linkedin'));
});

test('sold-out events report sold_out unless a waitlist is enabled', () => {
  const soldOut = normalizeEntry({ ...entry, ticket_info: { ...entry.ticket_info, is_sold_out: true } }, 'now');
  assert.equal(soldOut?.registration?.availability, 'sold_out');
});

test('rejects entries without a name or start', () => {
  assert.equal(normalizeEntry({ event: { api_id: 'evt-x' } }, 'now'), undefined);
});

test('extracts ProseMirror text by block', () => {
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
  ] };
  assert.equal(proseMirrorText(doc), 'Hello world\nSecond');
});

test('searchNearby filters the time window and stops after it', async () => {
  const calls: string[] = [];
  const fetchStub = (async (input: URL | RequestInfo) => {
    calls.push(String(input));
    const page = {
      entries: [
        { ...entry, event: { ...entry.event, api_id: 'evt-early', start_at: '2026-10-14T00:00:00.000Z' } },
        entry,
        { ...entry, event: { ...entry.event, api_id: 'evt-late', start_at: '2026-10-30T00:00:00.000Z' } },
      ],
      has_more: true,
      next_cursor: 'next',
    };
    return new Response(JSON.stringify(page), { status: 200 });
  }) as typeof fetch;
  const client = new LumaDiscoveryClient({ fetch: fetchStub });
  const result = await client.searchNearby({
    latitude: 37.3,
    longitude: -121.9,
    startsAfter: new Date('2026-10-15T00:00:00Z'),
    startsBefore: new Date('2026-10-20T00:00:00Z'),
  });
  assert.deepEqual(result.events.map((event) => event.providerEventId), ['evt-abc123']);
  assert.equal(calls.length, 1);
});

test('rejects invalid coordinates', async () => {
  await assert.rejects(new LumaDiscoveryClient().searchNearby({ latitude: 91, longitude: 0 }), /Latitude/);
});
