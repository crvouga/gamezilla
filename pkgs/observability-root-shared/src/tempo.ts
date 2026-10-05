import { ATTR } from './attributes';
import type { QueryFetch } from './local-explorer';
import { spansFromDocument } from './normalize';
import type {
  AdjacentActivity,
  TimeRange,
  Trace,
  TraceIdentifierKind,
  TraceMatch,
  TraceRef,
  TraceSchema,
  TraceStore,
} from './types';

const LOOKBACK_MS = 72 * 60 * 60 * 1000;
const RESULT_LIMIT = 50;
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

  private async search(query: string, range: TimeRange): Promise<TraceRef[]> {
    const params = new URLSearchParams({
      q: query,
      start: String(Math.floor(range.startMs / 1000)),
      end: String(Math.ceil(range.endMs / 1000)),
      limit: String(RESULT_LIMIT),
    });
    const response = await this.options.fetch(
      `${this.options.baseUrl}/api/search?${params.toString()}`,
      { headers: this.headers() }
    );
    if (!response.ok)
      throw new Error(`Tempo search failed (${String(response.status)})`);
    return traceRefs(await response.json());
  }

  recent(window: TimeRange): Promise<readonly TraceRef[]> {
    return this.search('{ true }', window);
  }
  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    const [beforeRefs, nearbyRefs, afterRefs] = await Promise.all([
      this.search('{ true }', {
        startMs: window.startMs - LOOKBACK_MS,
        endMs: window.startMs - 1,
      }),
      this.search('{ true }', window),
      this.search('{ true }', {
        startMs: window.endMs + 1,
        endMs: window.endMs + LOOKBACK_MS,
      }),
    ]);
    const before = [...beforeRefs].sort(
      (a, b) => b.startedAtMs - a.startedAtMs
    )[0];
    const after = [...afterRefs].sort(
      (a, b) => a.startedAtMs - b.startedAtMs
    )[0];
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
  findByUser(value: string, window: TimeRange): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.user, value, window);
  }
  findBySession(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.session, value, this.defaultRange());
  }
  findByMutation(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.mutation, value, this.defaultRange());
  }
  findByTest(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.test, value, this.defaultRange());
  }
  findByDevice(value: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(KEYS.device, value, this.defaultRange());
  }

  private byAttribute(
    key: string,
    value: string,
    range: TimeRange
  ): Promise<TraceRef[]> {
    const attribute = JSON.stringify(key);
    const expected = JSON.stringify(value);
    return this.search(
      `{ span.${attribute} = ${expected} || resource.${attribute} = ${expected} || event.${attribute} = ${expected} }`,
      range
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
      this.recent(this.defaultRange()),
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

function traceRefs(body: unknown): TraceRef[] {
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
        traceId,
        startedAtMs: Number(item['startTimeUnixNano'] ?? 0) / 1_000_000,
        durationMs: Number(
          item['durationMs'] ?? Number(item['durationNanos'] ?? 0) / 1_000_000
        ),
        spanCount: Number(item['spanCount'] ?? 0),
        errorCount: Number(item['errorCount'] ?? 0),
        rootName:
          typeof item['rootTraceName'] === 'string'
            ? item['rootTraceName']
            : 'unknown',
      },
    ];
  });
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
