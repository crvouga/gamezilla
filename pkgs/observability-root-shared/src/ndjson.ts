import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
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

const ATTRIBUTE_KEYS = {
  session: ATTR.SESSION_ID,
  mutation: ATTR.APP_MUTATION_ID,
  test: ATTR.APP_TEST_ID,
  user: ATTR.USER_ID,
  device: ATTR.APP_DEVICE_ID,
} as const satisfies Record<Exclude<TraceIdentifierKind, 'trace'>, string>;

function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function parseText(text: string): NarrateSpan[] {
  try {
    const document: unknown = JSON.parse(text);
    const spans = spansFromDocument(document);
    if (spans.length > 0) return spans;
  } catch {
    // NDJSON is expected not to parse as one JSON document.
  }
  const spans: NarrateSpan[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const document: unknown = JSON.parse(line);
      spans.push(...spansFromDocument(document));
    } catch {
      // Collector files can be appended while queried; ignore an incomplete tail.
    }
  }
  return spans;
}

function spanOrder(a: NarrateSpan, b: NarrateSpan): number {
  return a.startTimeMs - b.startTimeMs || compareCodeUnit(a.spanId, b.spanId);
}

function traceRef(traceId: string, spans: readonly NarrateSpan[]): TraceRef {
  const ordered = [...spans].sort(spanOrder);
  const first = ordered[0];
  const startedAtMs = first?.startTimeMs ?? 0;
  const endedAtMs = ordered.reduce(
    (latest, span) => Math.max(latest, span.startTimeMs + span.durationMs),
    startedAtMs
  );
  const root = ordered.find((span) => span.parentSpanId === undefined) ?? first;
  return {
    traceId,
    startedAtMs,
    durationMs: endedAtMs - startedAtMs,
    spanCount: spans.length,
    errorCount: spans.filter((span) => span.status === 'error').length,
    rootName: root?.name ?? 'unknown',
  };
}

function references(spans: readonly NarrateSpan[]): TraceRef[] {
  const grouped = new Map<string, NarrateSpan[]>();
  for (const span of spans) {
    const trace = grouped.get(span.traceId) ?? [];
    trace.push(span);
    grouped.set(span.traceId, trace);
  }
  return [...grouped.entries()]
    .map(([traceId, traceSpans]) => traceRef(traceId, traceSpans))
    .sort(
      (a, b) =>
        b.startedAtMs - a.startedAtMs || compareCodeUnit(a.traceId, b.traceId)
    );
}

function attributeMatches(
  span: NarrateSpan,
  key: string,
  value: string
): boolean {
  const matches = (attribute: NarrateSpan['attributes'][string]) =>
    Array.isArray(attribute)
      ? attribute.some((item) => String(item) === value)
      : attribute !== undefined && String(attribute) === value;
  return (
    matches(span.attributes[key]) ||
    (span.events?.some((event) => matches(event.attributes?.[key])) ?? false)
  );
}

function inRange(span: NarrateSpan, range: TimeRange): boolean {
  return span.startTimeMs >= range.startMs && span.startTimeMs <= range.endMs;
}

export class NdjsonTraceStore implements TraceStore {
  readonly source: string;
  private spansPromise: Promise<readonly NarrateSpan[]> | undefined;

  constructor(
    private readonly store: ObjectStore,
    source = 'ndjson'
  ) {
    this.source = source;
  }

  private async spans(): Promise<readonly NarrateSpan[]> {
    this.spansPromise ??= this.load();
    return this.spansPromise;
  }

  private async load(): Promise<readonly NarrateSpan[]> {
    const keys = (await this.store.listKeys()).filter(
      (key) => key.endsWith('.ndjson') || key.endsWith('.json')
    );
    const spans: NarrateSpan[] = [];
    for (const key of keys) {
      const text = await readUtf8(this.store, key);
      if (text !== null) spans.push(...parseText(text));
    }
    return spans.sort(spanOrder);
  }

  async recent(window: TimeRange): Promise<readonly TraceRef[]> {
    return references(
      (await this.spans()).filter((span) => inRange(span, window))
    );
  }

  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    const ordered = references(await this.spans());
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

  private async byAttribute(key: string, value: string): Promise<TraceRef[]> {
    const all = await this.spans();
    const traceIds = new Set(
      all
        .filter((span) => attributeMatches(span, key, value))
        .map((span) => span.traceId)
    );
    return references(all.filter((span) => traceIds.has(span.traceId)));
  }

  private async byAttributeInRange(
    key: string,
    value: string,
    window: TimeRange
  ): Promise<TraceRef[]> {
    return (await this.byAttribute(key, value)).filter(
      (ref) =>
        ref.startedAtMs >= window.startMs && ref.startedAtMs <= window.endMs
    );
  }

  findByUser(userId: string, window: TimeRange): Promise<readonly TraceRef[]> {
    return this.byAttributeInRange(ATTRIBUTE_KEYS.user, userId, window);
  }

  findBySession(sessionId: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(ATTRIBUTE_KEYS.session, sessionId);
  }

  findByMutation(mutationId: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(ATTRIBUTE_KEYS.mutation, mutationId);
  }

  findByTest(testId: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(ATTRIBUTE_KEYS.test, testId);
  }

  findByDevice(deviceId: string): Promise<readonly TraceRef[]> {
    return this.byAttribute(ATTRIBUTE_KEYS.device, deviceId);
  }

  async find(anything: string, window: TimeRange): Promise<TraceMatch | null> {
    if ((await this.getTrace(anything)) !== null) {
      const spans = (await this.getTrace(anything))?.spans ?? [];
      return {
        kind: 'trace',
        value: anything,
        traces: [traceRef(anything, spans)],
      };
    }
    const kinds = Object.keys(ATTRIBUTE_KEYS) as Exclude<
      TraceIdentifierKind,
      'trace'
    >[];
    for (const kind of kinds) {
      const key = ATTRIBUTE_KEYS[kind];
      const traces =
        kind === 'user'
          ? await this.byAttributeInRange(key, anything, window)
          : await this.byAttribute(key, anything);
      if (traces.length > 0) return { kind, value: anything, traces };
    }
    return null;
  }

  async getTrace(traceId: string): Promise<Trace | null> {
    const spans = (await this.spans()).filter(
      (span) => span.traceId === traceId
    );
    return spans.length === 0 ? null : { traceId, spans };
  }

  async schema(): Promise<TraceSchema> {
    const spans = await this.spans();
    return {
      attributeNames: [
        ...new Set(spans.flatMap((span) => Object.keys(span.attributes))),
      ].sort(compareCodeUnit),
      eventNames: [
        ...new Set(
          spans.flatMap((span) => span.events?.map((event) => event.name) ?? [])
        ),
      ].sort(compareCodeUnit),
      spanNames: [...new Set(spans.map((span) => span.name))].sort(
        compareCodeUnit
      ),
    };
  }
}
