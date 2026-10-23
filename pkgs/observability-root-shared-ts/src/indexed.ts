import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
import {
  adjacentOf,
  compareCodeUnit,
  shapeRefs,
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

const KEYS = {
  session: ATTR.SESSION_ID,
  mutation: ATTR.APP_MUTATION_ID,
  test: ATTR.APP_TEST_ID,
  user: ATTR.USER_ID,
  device: ATTR.APP_DEVICE_ID,
} as const satisfies Record<Exclude<TraceIdentifierKind, 'trace'>, string>;

type Kind = Exclude<TraceIdentifierKind, 'trace'>;

export class IndexedTraceStore implements TraceStore {
  constructor(
    readonly source: string,
    private readonly load: () => Promise<readonly NarrateSpan[]>
  ) {}

  private async all(): Promise<readonly NarrateSpan[]> {
    return this.load();
  }

  async recent(
    window: TimeRange,
    options?: RecentOptions
  ): Promise<readonly TraceRef[]> {
    const refs = traceRefsOf(
      (await this.all()).filter(
        (span) =>
          span.startTimeMs >= window.startMs && span.startTimeMs <= window.endMs
      )
    ).filter((ref) => options?.errorsOnly !== true || ref.errorCount > 0);
    return shapeRefs(refs, 'recent', options);
  }

  async adjacent(window: TimeRange): Promise<AdjacentActivity> {
    return adjacentOf(traceRefsOf(await this.all()), window);
  }

  private async by(
    kind: Kind,
    value: string,
    scope: { readonly window?: TimeRange; readonly options?: SearchOptions }
  ): Promise<TraceRef[]> {
    const refs = tracesWithAttribute(await this.all(), {
      key: KEYS[kind],
      value,
      ...(scope.window === undefined ? {} : { window: scope.window }),
    });
    return shapeRefs(refs, `${KEYS[kind]} = ${value}`, scope.options);
  }

  findByUser(
    userId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('user', userId, scopeOf(window, options));
  }
  findBySession(
    sessionId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('session', sessionId, scopeOf(window, options));
  }
  findByMutation(value: string): Promise<readonly TraceRef[]> {
    return this.by('mutation', value, {});
  }
  findByTest(value: string): Promise<readonly TraceRef[]> {
    return this.by('test', value, {});
  }
  findByDevice(
    deviceId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]> {
    return this.by('device', deviceId, scopeOf(window, options));
  }

  async find(value: string, window: TimeRange): Promise<TraceMatch | null> {
    const direct = await this.getTrace(value);
    if (direct !== null)
      return {
        kind: 'trace',
        value,
        traces: [traceRefOf(value, direct.spans)],
      };
    const kinds = Object.keys(KEYS) as Kind[];
    for (const kind of kinds) {
      const found = await this.by(
        kind,
        value,
        kind === 'user' ? { window } : {}
      );
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

function scopeOf(
  window: TimeRange,
  options: SearchOptions | undefined
): { readonly window: TimeRange; readonly options?: SearchOptions } {
  return options === undefined ? { window } : { window, options };
}
