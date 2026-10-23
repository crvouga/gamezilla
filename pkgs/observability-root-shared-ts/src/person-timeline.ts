import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
import {
  count,
  isDatabase,
  isProblem,
  isRejection,
  messageOf,
  mutationId,
  mutationName,
  oneLine,
  SPAN,
  text,
} from './person-spans';
import type { TimelineKind, TimelineRow } from './person-types';

/** A span this long, outside the database, is worth a row of its own. */
export const DEFAULT_SLOW_MS = 1_000;
/** Rows printed before the rest are elided; `--all` lifts it. */
export const DEFAULT_ROW_CAP = 60;

export type TimelineGap = { readonly elided: number };
export type TimelineEntry = TimelineRow | TimelineGap;

type Described = {
  readonly kind: TimelineKind;
  readonly text: string;
};

/**
 * The chronological story: what the person did and what the system did for
 * them. Database children are noise and stay in the per-trace summary, unless
 * they failed. Identical consecutive rows collapse into one with a repeat count.
 */
export function timelineRows(
  spans: readonly NarrateSpan[],
  options: { readonly slowMs: number }
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const ordered = [...spans].sort(
    (a, b) =>
      a.startTimeMs - b.startTimeMs ||
      (a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0) ||
      (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0)
  );
  for (const span of ordered) {
    const described = describe(span, options.slowMs);
    if (described === undefined) continue;
    const row: TimelineRow = {
      kind: described.kind,
      text: described.text,
      atMs: span.startTimeMs,
      untilMs: span.startTimeMs,
      durationMs: span.durationMs,
      failed: isProblem(span),
      repeat: 1,
      traceId: span.traceId,
      spanId: span.spanId,
    };
    const last = rows[rows.length - 1];
    if (last !== undefined && sameRow(last, row)) {
      rows[rows.length - 1] = {
        ...last,
        repeat: last.repeat + 1,
        untilMs: row.atMs,
        durationMs: Math.max(last.durationMs, row.durationMs),
      };
    } else {
      rows.push(row);
    }
  }
  return rows;
}

function sameRow(a: TimelineRow, b: TimelineRow): boolean {
  return a.kind === b.kind && a.text === b.text && a.failed === b.failed;
}

function describe(span: NarrateSpan, slowMs: number): Described | undefined {
  const failed = isProblem(span);
  if (isDatabase(span) && !failed) return undefined;
  const named = byName(span);
  if (named !== undefined) return named;
  if (failed) {
    const message = oneLine(messageOf(span));
    return {
      kind: 'error',
      text: `ERROR ${span.name}${message === '' ? '' : `: ${message}`}`,
    };
  }
  return span.durationMs >= slowMs
    ? { kind: 'slow', text: `SLOW ${span.name}` }
    : undefined;
}

function byName(span: NarrateSpan): Described | undefined {
  const { name } = span;
  if (name === SPAN.ROUTE_CHANGE) return routeRow(span);
  if (name === SPAN.INTERACTION_TIMING) return timingRow(span);
  if (name.startsWith(SPAN.INTERACTION_PREFIX)) return interactionRow(span);
  if (name === SPAN.HTTP_REQUEST) return requestRow(span);
  if (name === SPAN.MUTATION_REPLAY || name === SPAN.MUTATION_REJECTED)
    return mutationRow(span);
  if (name.startsWith(SPAN.ROOM_PREFIX)) return roomRow(span);
  return undefined;
}

function routeRow(span: NarrateSpan): Described {
  const target = text(span, ATTR.APP_INTERACTION_TARGET);
  return {
    kind: 'route',
    text: target === undefined ? 'route change' : `route change ${target}`,
  };
}

function interactionRow(span: NarrateSpan): Described {
  const type =
    text(span, ATTR.APP_INTERACTION_TYPE) ??
    span.name.slice(SPAN.INTERACTION_PREFIX.length);
  const target = text(span, ATTR.APP_INTERACTION_TARGET);
  const outcome = text(span, ATTR.APP_INTERACTION_OUTCOME);
  return {
    kind: 'interaction',
    text: [type, target, outcome === undefined ? undefined : `-> ${outcome}`]
      .filter((part): part is string => part !== undefined)
      .join(' '),
  };
}

function timingRow(span: NarrateSpan): Described {
  const type = text(span, ATTR.APP_INTERACTION_TYPE) ?? 'input';
  const target = text(span, ATTR.APP_INTERACTION_TARGET);
  return {
    kind: 'timing',
    text: `input ${type}${target === undefined ? '' : ` ${target}`}`,
  };
}

function requestRow(span: NarrateSpan): Described {
  const method = text(span, ATTR.HTTP_REQUEST_METHOD) ?? 'REQUEST';
  const route = text(span, ATTR.HTTP_ROUTE) ?? '(route not recorded)';
  const status = count(span, ATTR.HTTP_RESPONSE_STATUS_CODE);
  return {
    kind: 'request',
    text: `${method} ${route}${status === undefined ? '' : ` -> ${status}`}`,
  };
}

function mutationRow(span: NarrateSpan): Described {
  const name = mutationName(span);
  const id = mutationId(span) ?? span.spanId;
  const label = `mutation ${name === undefined ? '' : `${name} `}${id}`;
  if (!isRejection(span)) return { kind: 'mutation', text: `${label} applied` };
  const reason = oneLine(messageOf(span));
  return {
    kind: 'rejection',
    text: `${label} REJECTED${reason === '' ? '' : ` (${reason})`}`,
  };
}

function roomRow(span: NarrateSpan): Described {
  const action = span.name.slice(SPAN.ROOM_PREFIX.length);
  const topic = text(span, ATTR.APP_ROOM_TOPIC);
  const outcome = text(span, ATTR.APP_ROOM_OUTCOME);
  const bytes = count(span, ATTR.APP_ROOM_MESSAGE_BYTES);
  return {
    kind: 'room',
    text: [
      `room ${action}`,
      topic,
      outcome,
      bytes === undefined ? undefined : `${bytes}B`,
    ]
      .filter((part): part is string => part !== undefined)
      .join(' '),
  };
}

/**
 * Cut rows to `cap`, keeping failures first and then the rows nearest the
 * instant that was asked about; the survivors stay in time order and each
 * run of cut rows is marked where it was.
 */
export function capRows(
  rows: readonly TimelineRow[],
  cap: number,
  anchorMs: number
): { readonly elided: number; readonly entries: TimelineEntry[] } {
  if (rows.length <= cap) return { entries: [...rows], elided: 0 };
  const priority = rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        Number(b.row.failed) - Number(a.row.failed) ||
        Math.abs(a.row.atMs - anchorMs) - Math.abs(b.row.atMs - anchorMs) ||
        a.index - b.index
    );
  const keep = new Set(priority.slice(0, cap).map((item) => item.index));
  const entries: TimelineEntry[] = [];
  let run = 0;
  rows.forEach((row, index) => {
    if (keep.has(index)) {
      if (run > 0) entries.push({ elided: run });
      run = 0;
      entries.push(row);
    } else {
      run += 1;
    }
  });
  if (run > 0) entries.push({ elided: run });
  return { entries, elided: rows.length - keep.size };
}

export function isGap(entry: TimelineEntry): entry is TimelineGap {
  return 'elided' in entry;
}
