import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
import { spansFromDocument } from './normalize';
import {
  adjacentOf,
  compareCodeUnit,
  shapeRefs,
  spanOrder,
  traceRefOf,
  traceRefsOf,
  tracesWithAttribute,
} from './span-index';
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

const ATTRIBUTE_KEYS = {
  session: ATTR.SESSION_ID,
  mutation: ATTR.APP_MUTATION_ID,
  test: ATTR.APP_TEST_ID,
  user: ATTR.USER_ID,
  device: ATTR.APP_DEVICE_ID,
} as const satisfies Record<Exclude<TraceIdentifierKind, 'trace'>, string>;

function* parseText(text: string): Generator<NarrateSpan> {
  try {
    const document: unknown = JSON.parse(text);
    const spans = spansFromDocument(document);
    if (spans.length > 0) {
      yield* spans;
      return;
    }
  } catch {
    // NDJSON is expected not to parse as one JSON document.
  }
  let offset = 0;
  let previous: string | undefined;
  while (offset < text.length) {
    const newline = text.indexOf('\n', offset);
    const end = newline === -1 ? text.length : newline;
    const line = text.slice(offset, end);
    offset = end + 1;
    // The store retains one value per span ID. An identical adjacent record
    // cannot change that value; avoid both a giant split array and reparsing.
    if (line === previous) continue;
    previous = line;
    if (line.trim() === '') continue;
    try {
      const document: unknown = JSON.parse(line);
      yield* spansFromDocument(document);
    } catch {
      // Collector files can be appended while queried; ignore an incomplete tail.
    }
  }
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
    const spans = new Map<string, NarrateSpan>();
    for (const key of keys) {
      const text = await readUtf8(this.store, key);
      if (text === null) continue;
      for (const span of parseText(text)) {
        spans.set(`${span.traceId}:${span.spanId}`, span);
      }
    }
    return [...spans.values()].sort(spanOrder);
  }

  async recent(
    window: TimeRange,
    options?: RecentOptions
  ): Promise<readonly TraceRef[]> {
    const refs = traceRefsOf(
      (await this.spans()).filter(
        (span) =>
          span.startTimeMs >= window.startMs && span.startTimeMs <= window.endMs
      )
    ).filter((ref) => options?.errorsOnly !== true || ref.errorCount > 0);
    return shapeRefs(refs, 'recent', options);
  }

  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    return adjacentOf(traceRefsOf(await this.spans()), window);
  }

  private async by(
    kind: Exclude<TraceIdentifierKind, 'trace'>,
    value: string,
    scope: { readonly window?: TimeRange; readonly options?: SearchOptions }
  ): Promise<TraceRef[]> {
    const key = ATTRIBUTE_KEYS[kind];
    const refs = tracesWithAttribute(await this.spans(), {
      key,
      value,
      ...(scope.window === undefined ? {} : { window: scope.window }),
    });
    return shapeRefs(refs, `${key} = ${value}`, scope.options);
  }

  findByUser(
    userId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('user', userId, { window, ...optionsOf(options) });
  }

  findBySession(
    sessionId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('session', sessionId, { window, ...optionsOf(options) });
  }

  findByMutation(mutationId: string): Promise<readonly TraceRef[]> {
    return this.by('mutation', mutationId, {});
  }

  findByTest(testId: string): Promise<readonly TraceRef[]> {
    return this.by('test', testId, {});
  }

  findByDevice(
    deviceId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('device', deviceId, { window, ...optionsOf(options) });
  }

  async find(anything: string, window: TimeRange): Promise<TraceMatch | null> {
    const direct = await this.getTrace(anything);
    if (direct !== null) {
      return {
        kind: 'trace',
        value: anything,
        traces: [traceRefOf(anything, direct.spans)],
      };
    }
    const kinds = Object.keys(ATTRIBUTE_KEYS) as Exclude<
      TraceIdentifierKind,
      'trace'
    >[];
    for (const kind of kinds) {
      const traces = await this.by(
        kind,
        anything,
        kind === 'user' ? { window } : {}
      );
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

function optionsOf(options: SearchOptions | undefined): {
  readonly options?: SearchOptions;
} {
  return options === undefined ? {} : { options };
}
