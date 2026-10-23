import { ATTR } from './attributes';
import type { QueryFetch } from './local-explorer';
import type { NarrateSpan } from './narrate';
import { spansFromDocument } from './normalize';
import type { SearchHit } from './tempo-search';
import { PAGE_SIZE, pageRange } from './tempo-search';
import type {
  AdjacentActivity,
  RecentOptions,
  SearchOptions,
  TimeRange,
  Trace,
  TraceIdentifierKind,
  TraceMatch,
  TraceRef,
  TraceSchema,
  TraceStore,
} from './types';

const LOOKBACK_MS = 72 * 60 * 60 * 1000;
/** Traces a search reads before it says it stopped. */
const SEARCH_LIMIT = 200;
/** Traces `recent` reads for each of errors and newest activity. */
const RECENT_LIMIT = 50;
const ERRORS_QUERY = '{ status = error }';
const ANY_QUERY = '{ true }';
const TRACE_ID = /^[0-9a-f]{32}$/i;
const KEYS = {
  session: ATTR.SESSION_ID,
  mutation: ATTR.APP_MUTATION_ID,
  test: ATTR.APP_TEST_ID,
  user: ATTR.USER_ID,
  device: ATTR.APP_DEVICE_ID,
} as const;

type TempoOptions = {
  readonly baseUrl: string;
  readonly fetch: QueryFetch;
  readonly now: () => number;
  readonly token?: string;
  readonly username?: string;
};

export class TempoTraceStore implements TraceStore {
  readonly source: string;
  private readonly traces = new Map<string, Promise<Trace | null>>();
  constructor(private readonly options: TempoOptions) {
    this.source = `tempo:${options.baseUrl}`;
  }

  private headers(): HeadersInit {
    if (this.options.token === undefined) return {};
    if (this.options.username === undefined)
      return { authorization: `Bearer ${this.options.token}` };
    return {
      authorization: `Basic ${btoa(`${this.options.username}:${this.options.token}`)}`,
    };
  }

  private defaultRange(): TimeRange {
    const endMs = this.options.now();
    return { startMs: endMs - LOOKBACK_MS, endMs };
  }

  private async fetchPage(
    query: string,
    range: TimeRange
  ): Promise<SearchHit[]> {
    const params = new URLSearchParams({
      q: query,
      start: String(Math.floor(range.startMs / 1000)),
      end: String(Math.ceil(range.endMs / 1000)),
      limit: String(PAGE_SIZE),
    });
    const response = await this.options.fetch(
      `${this.options.baseUrl}/api/search?${params.toString()}`,
      { headers: this.headers() }
    );
    if (!response.ok)
      throw new Error(`Tempo search failed (${String(response.status)})`);
    return searchHits(await response.json());
  }

  private async search(
    query: string,
    range: TimeRange,
    options?: SearchOptions,
    label = query
  ): Promise<TraceRef[]> {
    const order = options?.order ?? 'newest';
    const paged = await pageRange(
      (part) => this.fetchPage(query, part),
      range,
      { limit: options?.limit ?? SEARCH_LIMIT, order }
    );
    // Tempo search metadata has no errorCount or spanCount. Read the bounded
    // result set before judging it; do not report unknown counts as zero.
    const hydrated: TraceRef[] = [];
    for (let offset = 0; offset < paged.hits.length; offset += 8) {
      const traces = await Promise.all(
        paged.hits
          .slice(offset, offset + 8)
          .map((hit) => this.getTrace(hit.traceId))
      );
      for (const trace of traces) {
        if (trace?.spans.some((span) => startsIn(span, range)) === true)
          hydrated.push(traceRef(trace));
      }
    }
    if (paged.truncated !== undefined) {
      options?.onTruncated?.({
        search: label,
        kept: hydrated.length,
        reason: paged.truncated,
      });
    }
    return hydrated.sort(
      (a, b) =>
        (order === 'newest'
          ? b.startedAtMs - a.startedAtMs
          : a.startedAtMs - b.startedAtMs) || compareId(a.traceId, b.traceId)
    );
  }

  /**
   * Every error trace, then the newest activity. Tempo returns an arbitrary
   * page for `{ true }`, so each part is paged to completeness by time.
   */
  async recent(
    window: TimeRange,
    options?: RecentOptions
  ): Promise<readonly TraceRef[]> {
    const shared = { limit: RECENT_LIMIT, ...options };
    const errors = await this.search(ERRORS_QUERY, window, shared);
    if (options?.errorsOnly === true) return errors;
    const newest = await this.search(ANY_QUERY, window, shared);
    const merged = new Map(errors.map((ref) => [ref.traceId, ref]));
    for (const ref of newest) merged.set(ref.traceId, ref);
    return [...merged.values()].sort(
      (a, b) =>
        Number(b.errorCount > 0) - Number(a.errorCount > 0) ||
        b.startedAtMs - a.startedAtMs ||
        compareId(a.traceId, b.traceId)
    );
  }

  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    const [beforeRefs, nearbyRefs, afterRefs] = await Promise.all([
      this.search(
        ANY_QUERY,
        { startMs: window.startMs - LOOKBACK_MS, endMs: window.startMs - 1 },
        { limit: 1, order: 'newest' }
      ),
      this.search(ANY_QUERY, window, { limit: RECENT_LIMIT }),
      this.search(
        ANY_QUERY,
        { startMs: window.endMs + 1, endMs: window.endMs + LOOKBACK_MS },
        { limit: 1, order: 'oldest' }
      ),
    ]);
    const before = beforeRefs[0];
    const after = afterRefs[0];
    const midpoint = window.startMs + (window.endMs - window.startMs) / 2;
    const nearby = [...nearbyRefs].sort(
      (a, b) =>
        Math.abs(a.startedAtMs - midpoint) - Math.abs(b.startedAtMs - midpoint)
    )[0];
    return {
      ...(after === undefined ? {} : { after }),
      ...(before === undefined ? {} : { before }),
      ...(nearby === undefined ? {} : { nearby }),
    };
  }
  findByUser(
    value: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.user, value, window, options);
  }
  findBySession(
    value: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.session, value, window, options);
  }
  findByMutation(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.mutation, value, this.defaultRange());
  }
  findByTest(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.test, value, this.defaultRange());
  }
  findByDevice(
    value: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.device, value, window, options);
  }

  private byAttribute(
    key: string,
    value: string,
    range: TimeRange,
    options?: SearchOptions
  ): Promise<TraceRef[]> {
    const attribute = JSON.stringify(key);
    const expected = JSON.stringify(value);
    return this.search(
      `{ span.${attribute} = ${expected} || resource.${attribute} = ${expected} || event.${attribute} = ${expected} }`,
      range,
      options,
      `${key} = ${value}`
    );
  }

  async find(value: string, window: TimeRange): Promise<TraceMatch | null> {
    if (TRACE_ID.test(value)) {
      const direct = await this.getTrace(value);
      if (direct !== null)
        return { kind: 'trace', value, traces: [traceRef(direct)] };
    }
    const kinds = Object.keys(KEYS) as Exclude<TraceIdentifierKind, 'trace'>[];
    for (const kind of kinds) {
      const traces = await this.byAttribute(KEYS[kind], value, window);
      if (traces.length > 0) return { kind, value, traces };
    }
    return null;
  }

  async getTrace(traceId: string): Promise<Trace | null> {
    let result = this.traces.get(traceId);
    if (result === undefined) {
      result = this.loadTrace(traceId);
      this.traces.set(traceId, result);
    }
    return result;
  }

  private async loadTrace(traceId: string): Promise<Trace | null> {
    const response = await this.options.fetch(
      `${this.options.baseUrl}/api/traces/${encodeURIComponent(traceId)}`,
      { headers: this.headers() }
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Tempo trace lookup failed (${String(response.status)})`);
    const spans = spansFromDocument(await response.json());
    return spans.length === 0 ? null : { traceId, spans };
  }

  async schema(): Promise<TraceSchema> {
    const [response, refs] = await Promise.all([
      this.options.fetch(
        `${this.options.baseUrl}/api/v2/search/tags?scope=span`,
        { headers: this.headers() }
      ),
      this.recent(this.defaultRange(), { limit: 25 }),
    ]);
    if (!response.ok)
      throw new Error(
        `Tempo schema lookup failed (${String(response.status)})`
      );
    const traces = await Promise.all(
      refs.map((reference) => this.getTrace(reference.traceId))
    );
    const spans = traces.flatMap((trace) => trace?.spans ?? []);
    return {
      attributeNames: unique([
        ...tagNames(await response.json()),
        ...spans.flatMap((span) => Object.keys(span.attributes)),
      ]),
      eventNames: unique(
        spans.flatMap((span) => span.events?.map((event) => event.name) ?? [])
      ),
      spanNames: unique(spans.map((span) => span.name)),
    };
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function searchHits(body: unknown): SearchHit[] {
  if (body === null || typeof body !== 'object') return [];
  const traces = (body as Record<string, unknown>)['traces'];
  if (!Array.isArray(traces)) return [];
  return traces.flatMap((value) => {
    if (value === null || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const traceId = item['traceID'];
    if (typeof traceId !== 'string') return [];
    return [
      {
        // Tempo drops leading zeros from the ids it lists.
        traceId: traceId.padStart(32, '0'),
        startedAtMs: Number(item['startTimeUnixNano'] ?? 0) / 1_000_000,
      },
    ];
  });
}

function startsIn(span: NarrateSpan, range: TimeRange): boolean {
  return span.startTimeMs >= range.startMs && span.startTimeMs <= range.endMs;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function traceRef(trace: Trace): TraceRef {
  const start = Math.min(...trace.spans.map((span) => span.startTimeMs));
  const end = Math.max(
    ...trace.spans.map((span) => span.startTimeMs + span.durationMs)
  );
  return {
    traceId: trace.traceId,
    startedAtMs: start,
    durationMs: end - start,
    spanCount: trace.spans.length,
    errorCount: trace.spans.filter((span) => span.status === 'error').length,
    rootName:
      trace.spans.find((span) => span.parentSpanId === undefined)?.name ??
      'unknown',
  };
}

function tagNames(body: unknown): string[] {
  if (body === null || typeof body !== 'object') return [];
  const scopes = (body as Record<string, unknown>)['scopes'];
  if (!Array.isArray(scopes)) return [];
  return scopes
    .flatMap((scope) => {
      if (scope === null || typeof scope !== 'object') return [];
      const tags = (scope as Record<string, unknown>)['tags'];
      return Array.isArray(tags)
        ? tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
    })
    .sort();
}
