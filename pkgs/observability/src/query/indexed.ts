import { ATTR, type NarrateSpan } from '@pkgs/observability/core';
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

const KEYS = {
  session: ATTR.SESSION_ID,
  mutation: ATTR.APP_MUTATION_ID,
  test: ATTR.APP_TEST_ID,
  user: ATTR.USER_ID,
  device: ATTR.APP_DEVICE_ID,
} as const;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function ref(traceId: string, spans: readonly NarrateSpan[]): TraceRef {
  const ordered = [...spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const start = ordered[0]?.startTimeMs ?? 0;
  const end = ordered.reduce(
    (latest, span) => Math.max(latest, span.startTimeMs + span.durationMs),
    start
  );
  const root =
    ordered.find((span) => span.parentSpanId === undefined) ?? ordered[0];
  return {
    traceId,
    startedAtMs: start,
    durationMs: end - start,
    spanCount: spans.length,
    errorCount: spans.filter((span) => span.status === 'error').length,
    rootName: root?.name ?? 'unknown',
  };
}

function refs(spans: readonly NarrateSpan[]): TraceRef[] {
  const traces = new Map<string, NarrateSpan[]>();
  for (const span of spans) {
    const values = traces.get(span.traceId) ?? [];
    values.push(span);
    traces.set(span.traceId, values);
  }
  return [...traces.entries()]
    .map(([traceId, values]) => ref(traceId, values))
    .sort(
      (a, b) => b.startedAtMs - a.startedAtMs || compare(a.traceId, b.traceId)
    );
}

function matches(span: NarrateSpan, key: string, value: string): boolean {
  const isValue = (attribute: NarrateSpan['attributes'][string]) =>
    Array.isArray(attribute)
      ? attribute.some((item) => String(item) === value)
      : attribute !== undefined && String(attribute) === value;
  return (
    isValue(span.attributes[key]) ||
    (span.events?.some((event) => isValue(event.attributes?.[key])) ?? false)
  );
}

export class IndexedTraceStore implements TraceStore {
  constructor(
    readonly source: string,
    private readonly load: () => Promise<readonly NarrateSpan[]>
  ) {}

  private async all(): Promise<readonly NarrateSpan[]> {
    return this.load();
  }

  async recent(window: TimeRange): Promise<readonly TraceRef[]> {
    return refs(
      (await this.all()).filter(
        (span) =>
          span.startTimeMs >= window.startMs && span.startTimeMs <= window.endMs
      )
    );
  }

  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    const ordered = refs(await this.all());
    const before = ordered.find((item) => item.startedAtMs < window.startMs);
    const after = [...ordered]
      .reverse()
      .find((item) => item.startedAtMs > window.endMs);
    const midpoint = window.startMs + (window.endMs - window.startMs) / 2;
    const nearby = ordered
      .filter(
        (item) =>
          item.startedAtMs >= window.startMs && item.startedAtMs <= window.endMs
      )
      .sort(
        (a, b) =>
          Math.abs(a.startedAtMs - midpoint) -
          Math.abs(b.startedAtMs - midpoint)
      )[0];
    return {
      ...(after === undefined ? {} : { after }),
      ...(before === undefined ? {} : { before }),
      ...(nearby === undefined ? {} : { nearby }),
    };
  }

  private async by(key: string, value: string): Promise<TraceRef[]> {
    const all = await this.all();
    const ids = new Set(
      all
        .filter((span) => matches(span, key, value))
        .map((span) => span.traceId)
    );
    return refs(all.filter((span) => ids.has(span.traceId)));
  }

  async findByUser(
    userId: string,
    window: TimeRange
  ): Promise<readonly TraceRef[]> {
    return (await this.by(KEYS.user, userId)).filter(
      (item) =>
        item.startedAtMs >= window.startMs && item.startedAtMs <= window.endMs
    );
  }

  findBySession(value: string): Promise<readonly TraceRef[]> {
    return this.by(KEYS.session, value);
  }
  findByMutation(value: string): Promise<readonly TraceRef[]> {
    return this.by(KEYS.mutation, value);
  }
  findByTest(value: string): Promise<readonly TraceRef[]> {
    return this.by(KEYS.test, value);
  }
  findByDevice(value: string): Promise<readonly TraceRef[]> {
    return this.by(KEYS.device, value);
  }

  async find(value: string, window: TimeRange): Promise<TraceMatch | null> {
    const direct = await this.getTrace(value);
    if (direct !== null)
      return { kind: 'trace', value, traces: [ref(value, direct.spans)] };
    const kinds = Object.keys(KEYS) as Exclude<TraceIdentifierKind, 'trace'>[];
    for (const kind of kinds) {
      const found =
        kind === 'user'
          ? await this.findByUser(value, window)
          : await this.by(KEYS[kind], value);
      if (found.length > 0) return { kind, value, traces: found };
    }
    return null;
  }

  async getTrace(traceId: string): Promise<Trace | null> {
    const spans = (await this.all()).filter((span) => span.traceId === traceId);
    return spans.length === 0 ? null : { traceId, spans };
  }

  async schema(): Promise<TraceSchema> {
    const spans = await this.all();
    return {
      attributeNames: [
        ...new Set(spans.flatMap((span) => Object.keys(span.attributes))),
      ].sort(compare),
      eventNames: [
        ...new Set(
          spans.flatMap((span) => span.events?.map((event) => event.name) ?? [])
        ),
      ].sort(compare),
      spanNames: [...new Set(spans.map((span) => span.name))].sort(compare),
    };
  }
}
