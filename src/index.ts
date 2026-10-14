import type { DiscoveredEvent, RegistrationAvailability } from './types.js';

export type * from './types.js';

const DEFAULT_BASE_URL = 'https://api.lu.ma';
const DEFAULT_USER_AGENT = 'luma-discovery/0.1 (+https://github.com/mihirkavi/luma-discovery)';
const MAX_PAGE_SIZE = 50;

export interface LumaClientOptions {
  /** Override for tests or a proxy. Defaults to Luma's public web API host. */
  baseUrl?: string;
  userAgent?: string;
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. Defaults to 10 seconds. */
  timeoutMs?: number;
}

export interface NearbySearch {
  latitude: number;
  longitude: number;
  /** Only return events that start at or after this instant. */
  startsAfter?: Date;
  /** Only return events that start before this instant. */
  startsBefore?: Date;
  /** Maximum events to return after filtering. Defaults to 100, capped at 300. */
  limit?: number;
  /** Maximum pages to request. Defaults to 4. Each page holds up to 50 events. */
  maxPages?: number;
}

export interface SearchResult {
  events: DiscoveredEvent[];
  pagesFetched: number;
  /** True when more matching events probably exist beyond the page budget. */
  truncated: boolean;
}

export class LumaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'LumaError';
  }
}

/**
 * Read-only client for Luma's public discovery data — the same JSON the public
 * lu.ma website loads for signed-out visitors. It is not Luma's documented
 * organizer API, so responses can change without notice. It never signs in,
 * never registers, and strips guest and attendee identities from every result.
 */
export class LumaDiscoveryClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LumaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  /** Public events near a coordinate, in Luma's start-time order. */
  async searchNearby(search: NearbySearch): Promise<SearchResult> {
    validateCoordinate(search.latitude, search.longitude);
    const limit = Math.min(Math.max(search.limit ?? 100, 1), 300);
    const maxPages = Math.min(Math.max(search.maxPages ?? 4, 1), 10);
    const events: DiscoveredEvent[] = [];
    let cursor: string | undefined;
    let pagesFetched = 0;
    let truncated = false;

    while (pagesFetched < maxPages) {
      const url = new URL(`${this.baseUrl}/discover/get-paginated-events`);
      url.searchParams.set('latitude', String(search.latitude));
      url.searchParams.set('longitude', String(search.longitude));
      url.searchParams.set('pagination_limit', String(MAX_PAGE_SIZE));
      if (cursor) url.searchParams.set('pagination_cursor', cursor);
      const page = await this.getJSON<DiscoverPage>(url);
      pagesFetched += 1;
      const retrievedAt = new Date().toISOString();
      let pastWindow = false;
      for (const entry of page.entries ?? []) {
        const event = normalizeEntry(entry, retrievedAt);
        if (!event) continue;
        const starts = Date.parse(event.startsAt);
        if (search.startsBefore && starts >= search.startsBefore.getTime()) {
          pastWindow = true;
          continue;
        }
        if (search.startsAfter && starts < search.startsAfter.getTime()) continue;
        events.push(event);
      }
      if (events.length >= limit || pastWindow) break;
      if (!page.has_more || !page.next_cursor) break;
      cursor = page.next_cursor;
      if (pagesFetched === maxPages) truncated = true;
    }

    return { events: events.slice(0, limit), pagesFetched, truncated: truncated || events.length > limit };
  }

  /** Full public details for one event, by `evt-…` id or lu.ma URL/slug. */
  async getEvent(idOrUrl: string): Promise<DiscoveredEvent> {
    const url = new URL(`${this.baseUrl}/event/get`);
    const id = idOrUrl.trim();
    if (/^evt-[A-Za-z0-9]+$/.test(id)) url.searchParams.set('event_api_id', id);
    else url.searchParams.set('url', slugFromUrl(id));
    const body = await this.getJSON<EventDetail>(url);
    const event = normalizeEntry(body, new Date().toISOString());
    if (!event) throw new LumaError('Luma returned an event without a name or start time.');
    const description = proseMirrorText(body.description_mirror);
    if (description) event.description = description.slice(0, 8_000);
    const categories = (body.categories ?? []).map((category) => category.name).filter(isNonEmpty);
    if (categories.length) event.categories = categories;
    return event;
  }

  private async getJSON<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json', 'user-agent': this.userAgent },
        signal: controller.signal,
      });
      if (response.status === 404) throw new LumaError('Luma event not found.', 404);
      if (response.status === 429) throw new LumaError('Luma rate limited the request. Try again later.', 429);
      if (!response.ok) throw new LumaError(`Luma request failed with HTTP ${response.status}.`, response.status);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof LumaError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new LumaError('Luma request timed out.');
      throw new LumaError(error instanceof Error ? error.message : 'Luma request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}

interface DiscoverPage {
  entries?: EventEntry[];
  has_more?: boolean;
  next_cursor?: string;
}

interface EventEntry {
  api_id?: string;
  event?: LumaEvent;
  calendar?: { api_id?: string; name?: string; slug?: string | null; is_personal?: boolean };
  hosts?: Array<{ name?: string }>;
  guest_count?: number;
  ticket_info?: {
    price?: { cents?: number; currency?: string } | null;
    is_free?: boolean;
    max_price?: { cents?: number; currency?: string } | null;
    is_sold_out?: boolean;
    spots_remaining?: number | null;
    require_approval?: boolean;
  } | null;
  registration_availability?: string;
}

interface EventDetail extends EventEntry {
  description_mirror?: unknown;
  categories?: Array<{ name?: string }>;
}

interface LumaEvent {
  api_id?: string;
  name?: string;
  start_at?: string;
  end_at?: string | null;
  timezone?: string | null;
  url?: string;
  location_type?: string;
  cover_url?: string | null;
  recurrence_id?: string | null;
  waitlist_status?: string;
  geo_address_info?: {
    city?: string;
    region?: string;
    country?: string;
    address?: string;
    full_address?: string;
  } | null;
  coordinate?: { latitude?: number; longitude?: number } | null;
}

/** Exported for tests and for callers that already hold Luma payloads. */
export function normalizeEntry(entry: EventEntry, retrievedAt: string): DiscoveredEvent | undefined {
  const event = entry.event;
  if (!event?.api_id || !event.name || !event.start_at) return undefined;
  const slug = event.url || event.api_id;
  const pageUrl = `https://lu.ma/${slug}`;
  const geo = event.geo_address_info ?? undefined;
  const coordinate = event.coordinate ?? undefined;
  const ticket = entry.ticket_info ?? undefined;
  const organizerName = entry.calendar && !entry.calendar.is_personal && entry.calendar.name
    ? entry.calendar.name
    : entry.hosts?.map((host) => host.name).filter(isNonEmpty).slice(0, 3).join(', ');

  const result: DiscoveredEvent = {
    provider: 'luma',
    providerEventId: event.api_id,
    url: pageUrl,
    title: event.name.trim(),
    startsAt: event.start_at,
    ...(event.end_at ? { endsAt: event.end_at } : {}),
    ...(event.timezone ? { timezone: event.timezone } : {}),
    status: 'scheduled',
    attendanceMode: event.location_type === 'online' ? 'online' : event.location_type === 'offline' ? 'in_person' : 'unknown',
    retrievedAt,
  };
  if (geo || coordinate) {
    result.venue = compact({
      name: geo?.address,
      address: geo?.full_address,
      city: geo?.city,
      region: geo?.region,
      country: geo?.country,
      latitude: finite(coordinate?.latitude),
      longitude: finite(coordinate?.longitude),
    });
  }
  if (organizerName) {
    result.organizer = compact({
      name: organizerName,
      providerId: entry.calendar?.api_id,
      url: entry.calendar?.slug ? `https://lu.ma/${entry.calendar.slug}` : undefined,
    });
  }
  if (event.cover_url) result.imageUrl = event.cover_url;
  if (ticket) {
    result.price = compact({
      isFree: ticket.is_free,
      minCents: ticket.price?.cents,
      maxCents: ticket.max_price?.cents,
      currency: ticket.price?.currency ?? ticket.max_price?.currency,
    });
  }
  result.registration = compact({
    availability: availability(entry, event),
    requiresApproval: ticket?.require_approval,
    spotsRemaining: ticket?.spots_remaining ?? undefined,
    url: pageUrl,
  });
  result.recurrence = compact({ isRecurring: Boolean(event.recurrence_id), seriesId: event.recurrence_id ?? undefined });
  if (typeof entry.guest_count === 'number') result.attendeeCount = entry.guest_count;
  return result;
}

function availability(entry: EventEntry, event: LumaEvent): RegistrationAvailability {
  if (entry.ticket_info?.is_sold_out) return event.waitlist_status === 'enabled' ? 'waitlist' : 'sold_out';
  if (entry.registration_availability && entry.registration_availability !== 'open') return 'closed';
  if (entry.ticket_info?.require_approval) return 'approval_required';
  if (entry.registration_availability === 'open') return 'open';
  return 'unknown';
}

/** Extracts readable text from Luma's ProseMirror description document. */
export function proseMirrorText(node: unknown): string {
  const blocks: string[] = [];
  const walk = (value: unknown, sink: string[]) => {
    if (!value || typeof value !== 'object') return;
    const item = value as { type?: string; text?: string; content?: unknown[] };
    if (typeof item.text === 'string') sink.push(item.text);
    if (Array.isArray(item.content)) {
      const isBlock = item.type === 'paragraph' || item.type === 'heading' || item.type === 'list_item';
      const inner: string[] = [];
      for (const child of item.content) walk(child, isBlock ? inner : sink);
      if (isBlock) blocks.push(inner.join(''));
    }
  };
  const loose: string[] = [];
  walk(node, loose);
  return [...blocks, ...loose].map((line) => line.trim()).filter(Boolean).join('\n');
}

function slugFromUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (!/(^|\.)lu\.ma$|(^|\.)luma\.com$/.test(parsed.hostname)) throw new LumaError('Not a Luma URL.');
    return parsed.pathname.replace(/^\/+|\/+$/g, '');
  } catch (error) {
    if (error instanceof LumaError) throw error;
    if (!/^[A-Za-z0-9_-]{2,80}$/.test(value)) throw new LumaError('Expected a Luma event id, URL, or slug.');
    return value;
  }
}

function validateCoordinate(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new LumaError('Latitude must be between -90 and 90.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new LumaError('Longitude must be between -180 and 180.');
}

function finite(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')) as T;
}
