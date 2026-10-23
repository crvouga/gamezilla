import type { NarrateSpan } from './narrate';
import type { SearchOptions, TimeRange, TraceRef } from './types';

/** Shared reading of a span list for the stores that hold every span in memory. */

export function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function spanOrder(a: NarrateSpan, b: NarrateSpan): number {
  return a.startTimeMs - b.startTimeMs || compareCodeUnit(a.spanId, b.spanId);
}

export function traceRefOf(
  traceId: string,
  spans: readonly NarrateSpan[]
): TraceRef {
  let first: NarrateSpan | undefined;
  let root: NarrateSpan | undefined;
  let endedAtMs = Number.NEGATIVE_INFINITY;
  let errorCount = 0;
  for (const span of spans) {
    if (first === undefined || spanOrder(span, first) < 0) first = span;
    if (
      span.parentSpanId === undefined &&
      (root === undefined || spanOrder(span, root) < 0)
    )
      root = span;
    endedAtMs = Math.max(endedAtMs, span.startTimeMs + span.durationMs);
    if (span.status === 'error') errorCount += 1;
  }
  const startedAtMs = first?.startTimeMs ?? 0;
  return {
    traceId,
    startedAtMs,
    durationMs: Math.max(startedAtMs, endedAtMs) - startedAtMs,
    spanCount: spans.length,
    errorCount,
    rootName: (root ?? first)?.name ?? 'unknown',
  };
}

/** One reference per trace, newest first. */
export function traceRefsOf(spans: readonly NarrateSpan[]): TraceRef[] {
  const grouped = new Map<string, NarrateSpan[]>();
  for (const span of spans) {
    const trace = grouped.get(span.traceId) ?? [];
    trace.push(span);
    grouped.set(span.traceId, trace);
  }
  return [...grouped.entries()]
    .map(([traceId, traceSpans]) => traceRefOf(traceId, traceSpans))
    .sort(newestFirst);
}

export function newestFirst(a: TraceRef, b: TraceRef): number {
  return b.startedAtMs - a.startedAtMs || compareCodeUnit(a.traceId, b.traceId);
}

export function spanStartsIn(span: NarrateSpan, range: TimeRange): boolean {
  return span.startTimeMs >= range.startMs && span.startTimeMs <= range.endMs;
}

export function spanHasAttribute(
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

/**
 * Traces with a span carrying `key = value`. Given a window, the carrying span
 * must start inside it, as in a Tempo range search; the whole trace is kept.
 */
export function tracesWithAttribute(
  spans: readonly NarrateSpan[],
  query: {
    readonly key: string;
    readonly value: string;
    readonly window?: TimeRange;
  }
): TraceRef[] {
  const ids = new Set(
    spans
      .filter(
        (span) =>
          spanHasAttribute(span, query.key, query.value) &&
          (query.window === undefined || spanStartsIn(span, query.window))
      )
      .map((span) => span.traceId)
  );
  return traceRefsOf(spans.filter((span) => ids.has(span.traceId)));
}

/** Order, cut to the limit and announce the cut. */
export function shapeRefs(
  refs: readonly TraceRef[],
  search: string,
  options: SearchOptions | undefined
): TraceRef[] {
  const ordered = [...refs].sort(newestFirst);
  if (options?.order === 'oldest') ordered.reverse();
  const limit = options?.limit;
  if (limit === undefined || ordered.length <= limit) return ordered;
  const kept = ordered.slice(0, limit);
  options?.onTruncated?.({ search, kept: kept.length, reason: 'limit' });
  return kept;
}

export function adjacentOf(
  all: readonly TraceRef[],
  window: TimeRange
): {
  readonly after?: TraceRef;
  readonly before?: TraceRef;
  readonly nearby?: TraceRef;
} {
  const ordered = [...all].sort(newestFirst);
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
        Math.abs(a.startedAtMs - midpoint) - Math.abs(b.startedAtMs - midpoint)
    )[0];
  return {
    ...(after === undefined ? {} : { after }),
    ...(before === undefined ? {} : { before }),
    ...(nearby === undefined ? {} : { nearby }),
  };
}
