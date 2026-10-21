import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
import {
  isDatabase,
  isProblem,
  isRejection,
  mutationId,
  SPAN,
  text,
} from './person-spans';
import { utcIso } from './person-time';
import type {
  ActivityTrace,
  PersonSummary,
  PersonTraceSummary,
} from './person-types';
import { compareCodeUnit } from './span-index';
import type { TimeRange } from './types';

export function spansInWindow(
  traces: readonly ActivityTrace[],
  range: TimeRange
): NarrateSpan[] {
  return traces.flatMap((item) =>
    item.trace.spans.filter(
      (span) =>
        span.startTimeMs >= range.startMs && span.startTimeMs <= range.endMs
    )
  );
}

/**
 * Counts of what happened, from the spans that start inside the window.
 * The connection place and device clock come from the place selection.
 */
export function summarize(
  spans: readonly NarrateSpan[],
  traces: number
): PersonSummary {
  const rejected = new Set<string>();
  let mutations = 0;
  let requests = 0;
  let errors = 0;
  for (const span of spans) {
    if (span.name === SPAN.HTTP_REQUEST) requests += 1;
    if (span.name === SPAN.MUTATION_REPLAY) mutations += 1;
    if (isProblem(span)) errors += 1;
    if (isRejection(span)) rejected.add(mutationId(span) ?? span.spanId);
  }
  return {
    traces,
    requests,
    mutations,
    errors,
    rejected: rejected.size,
    builds: distinct(spans, ATTR.APP_BUILD_SHA),
    devices: distinct(spans, ATTR.APP_DEVICE_ID),
    sessions: distinct(spans, ATTR.SESSION_ID),
  };
}

/** One line per trace: its size and the time it spent in the database. */
export function summarizeTraces(
  traces: readonly ActivityTrace[]
): PersonTraceSummary[] {
  return traces
    .map((item) => {
      const database = item.trace.spans.filter(isDatabase);
      return {
        traceId: item.trace.traceId,
        rootName: item.ref.rootName,
        startedAtUtc: utcIso(item.ref.startedAtMs),
        spanCount: item.trace.spans.length,
        errorCount: item.trace.spans.filter(isProblem).length,
        dbQueries: database.length,
        dbMs: Math.round(
          database.reduce((sum, span) => sum + span.durationMs, 0)
        ),
        via: item.via,
        accounts: item.accounts,
      };
    })
    .sort(
      (a, b) =>
        compareCodeUnit(a.startedAtUtc, b.startedAtUtc) ||
        compareCodeUnit(a.traceId, b.traceId)
    );
}

function distinct(spans: readonly NarrateSpan[], key: string): string[] {
  return [...new Set(spans.flatMap((span) => text(span, key) ?? []))].sort();
}
