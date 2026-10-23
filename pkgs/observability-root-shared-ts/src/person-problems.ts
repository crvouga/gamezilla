import type { NarrateSpan } from './narrate';
import {
  hasException,
  isRejection,
  messageOf,
  oneLine,
  SPAN,
} from './person-spans';
import type { PersonZone } from './person-time';
import { localIso, utcIso } from './person-time';
import type {
  ActivityTrace,
  PersonProblem,
  ProblemSeverity,
} from './person-types';
import type { TimeRange } from './types';

const ORDER: Readonly<Record<ProblemSeverity, number>> = {
  crash: 0,
  failure: 1,
  rejection: 2,
  handled: 3,
};

export type FoundProblem = {
  readonly severity: ProblemSeverity;
  readonly span: NarrateSpan;
};

/** What kind of trouble a span records; `undefined` when it records none. */
export function severityOf(span: NarrateSpan): ProblemSeverity | undefined {
  if (span.name === SPAN.CLIENT_ERROR || span.name === SPAN.RUNTIME_ERROR)
    return 'crash';
  if (isRejection(span) && span.status === 'error') return 'rejection';
  if (span.status === 'error') return 'failure';
  return hasException(span) ? 'handled' : undefined;
}

/**
 * Every error span of the traces that starts inside the range, worst first
 * (crash, failure, rejection, handled exception), newest first within a kind.
 * Nothing is dropped: the caller decides how many to print.
 */
export function findProblems(
  traces: readonly ActivityTrace[],
  range: TimeRange
): FoundProblem[] {
  const found: FoundProblem[] = [];
  for (const item of traces) {
    for (const span of item.trace.spans) {
      if (span.startTimeMs < range.startMs || span.startTimeMs > range.endMs)
        continue;
      const severity = severityOf(span);
      if (severity !== undefined) found.push({ span, severity });
    }
  }
  return found.sort(
    (a, b) =>
      ORDER[a.severity] - ORDER[b.severity] ||
      b.span.startTimeMs - a.span.startTimeMs ||
      (a.span.spanId < b.span.spanId
        ? -1
        : a.span.spanId > b.span.spanId
          ? 1
          : 0)
  );
}

export function describeProblem(
  found: FoundProblem,
  rank: number,
  context: { readonly sourceFlag?: string; readonly zone: PersonZone }
): PersonProblem {
  const { span } = found;
  const flag =
    context.sourceFlag === undefined ? '' : ` --source ${context.sourceFlag}`;
  return {
    rank,
    severity: found.severity,
    name: span.name,
    message: oneLine(messageOf(span)),
    traceId: span.traceId,
    spanId: span.spanId,
    atUtc: utcIso(span.startTimeMs),
    atLocal: localIso(span.startTimeMs, context.zone),
    drill: {
      trace: `bun obs trace ${span.traceId}${flag}`,
      span: `bun obs span ${span.traceId} ${span.spanId}${flag}`,
    },
  };
}
