import { humanSpan } from './person-time';
import type {
  PersonAccount,
  PersonData,
  PersonProblem,
  SeenAt,
  TimelineGapData,
  TimelineRowData,
} from './person-types';

/** Problems printed before the rest are counted; `--all` lifts it. */
export const PROBLEM_CAP = 20;
const TRACE_CAP = 15;
const KIND_WIDTH = 11;

export type RenderFlags = {
  readonly all: boolean;
  /** The command that asks the same question over a wider window. */
  readonly widen: string;
  /** The command that prints every row. */
  readonly showAll: string;
};

/** The text report; the same facts as `--json`, laid out for a person. */
export function renderPerson(data: PersonData, flags: RenderFlags): string {
  const lines = [...head(data)];
  if (data.status === 'account-not-found')
    return [...lines, ...notFound(data)].join('\n');
  if (data.status === 'invalid-clock')
    return [...lines, ...invalidClock(data)].join('\n');
  lines.push(...accountLines(data));
  if (data.status === 'quiet') return [...lines, ...quiet(data)].join('\n');
  lines.push(...placeLines(data), ...summaryLines(data));
  lines.push(...data.truncations.map((note) => `WARNING truncated: ${note}`));
  lines.push(...data.notes.map((note) => `note: ${note}`));
  lines.push('', ...problemLines(data, flags));
  lines.push('', ...timelineLines(data, flags));
  lines.push('', ...traceLines(data));
  lines.push(...data.next.map((next) => `next: ${next}`));
  return lines.join('\n');
}

function head(data: PersonData): string[] {
  return [
    'obs/v1',
    `source: ${data.source}`,
    ...(data.window === undefined
      ? []
      : [`utc-range: ${data.window.startUtc} .. ${data.window.endUtc}`]),
    ...(data.clock === undefined
      ? []
      : [`clock: ${data.clock.label} = ${data.clock.instantUtc}`]),
  ];
}

function accountLines(data: PersonData): string[] {
  const shown = data.accounts.filter((account) => account.shown);
  const lines = shown.map(
    (account) =>
      `person: ${data.question.name} -> user.id ${account.userId} (matched as ${account.matchedAs})`
  );
  if (data.accounts.length > 1) {
    lines.push(
      `people: ${data.accounts.length} share this name; ${shown.length} match this place and time`,
      ...data.accounts.map(accountReason)
    );
  }
  return lines;
}

function accountReason(account: PersonAccount): string {
  return `  user.id ${account.userId}: ${account.shown ? 'shown' : 'left out'}; ${account.reason}; ${account.traces} traces`;
}

function placeLines(data: PersonData): string[] {
  const summary = data.summary;
  const asked = data.question.place?.trim() ?? '';
  const matched = data.accounts.some(
    (account) =>
      account.shown && (account.place === 'city' || account.place === 'region')
  );
  const where = summary?.connection;
  const place =
    asked.length === 0
      ? 'place: not asked'
      : matched
        ? `place: matched ${asked}`
        : `place: asked ${asked}; connection appeared at ${where ?? 'an unrecorded place'}`;
  return [
    `connection: ${where ?? 'not recorded'}`,
    `device-clock: ${summary?.deviceClock ?? 'not recorded'}`,
    place,
  ];
}

function summaryLines(data: PersonData): string[] {
  const s = data.summary;
  if (s === undefined) return [];
  return [
    `summary: ${s.traces} traces, ${s.requests} requests, ${s.errors} errors, ${s.mutations} mutations (${s.rejected} rejected)`,
    ...listLine('builds', s.builds),
    ...listLine('devices', s.devices),
    ...listLine('sessions', s.sessions),
  ];
}

function listLine(label: string, values: readonly string[]): string[] {
  return [
    `${label}: ${values.length === 0 ? 'not recorded' : values.join(', ')}`,
  ];
}

function problemLines(data: PersonData, flags: RenderFlags): string[] {
  const s = data.summary;
  if (data.problems.length === 0) {
    return [
      `No error was recorded; ${s?.requests ?? 0} requests, ${s?.mutations ?? 0} mutations (${s?.rejected ?? 0} rejected) in ${s?.traces ?? 0} traces.`,
    ];
  }
  const shown = flags.all ? data.problems : data.problems.slice(0, PROBLEM_CAP);
  const lines = [
    `PROBLEMS (${data.problems.length}, worst first, newest first)`,
  ];
  for (const problem of shown) lines.push(...problemEntry(problem, data));
  const hidden = data.problems.length - shown.length;
  if (hidden > 0) {
    lines.push(
      `… ${hidden} more problems not printed; all of them: ${flags.showAll}`
    );
  }
  return lines;
}

function problemEntry(problem: PersonProblem, data: PersonData): string[] {
  const message = problem.message === '' ? '' : `: ${problem.message}`;
  return [
    `${problem.rank}. [${problem.severity}] ${problem.name}${message}`,
    `   at ${stampOf(problem.atLocal, problem.atUtc, data)}`,
    `   ${problem.drill.span}`,
    `   ${problem.drill.trace}`,
  ];
}

function timelineLines(data: PersonData, flags: RenderFlags): string[] {
  const { rows, total, elided } = data.timeline;
  const zone = data.clock?.zoneLabel ?? 'UTC';
  const lines = [
    `TIMELINE (${zone} | UTC; ${total - elided} of ${total} rows shown)`,
  ];
  if (rows.length === 0)
    lines.push('  (nothing the person or the system did stands out)');
  const refs = traceRefs(data);
  const width = Math.max(2, ...[...refs.values()].map((ref) => ref.length));
  for (const row of rows) {
    lines.push(
      isGapData(row)
        ? `  … ${row.elided} rows elided`
        : rowLine(row, data, { refs, width })
    );
  }
  if (elided > 0) {
    lines.push(
      `${elided} rows elided; widen the window: ${flags.widen}  or show every row: ${flags.showAll}`
    );
  }
  return lines;
}

function isGapData(
  row: TimelineRowData | TimelineGapData
): row is TimelineGapData {
  return row.kind === 'elided';
}

function rowLine(
  row: TimelineRowData,
  data: PersonData,
  columns: {
    readonly refs: ReadonlyMap<string, string>;
    readonly width: number;
  }
): string {
  const failed = row.failed && row.kind !== 'error' ? ' [ERROR]' : '';
  const repeat =
    row.repeat > 1 && row.untilUtc !== undefined
      ? ` (x${row.repeat}, until ${row.untilUtc.slice(11, 19)}Z)`
      : '';
  return `${stampOf(row.atLocal, row.atUtc, data)}  ${(columns.refs.get(row.traceId) ?? row.traceId.slice(0, 8)).padEnd(columns.width)} ${row.kind.padEnd(KIND_WIDTH)} ${row.summary}${durationText(row)}${failed}${repeat}`;
}

function durationText(row: TimelineRowData): string {
  if (row.kind === 'route' || row.kind === 'interaction') return '';
  return row.durationMs < 1 ? '' : `  ${durationOf(row.durationMs)}`;
}

function durationOf(ms: number): string {
  return ms < 1_000 ? `${Math.round(ms)}ms` : `${(ms / 1_000).toFixed(2)}s`;
}

/** t1, t2, ... for the traces the timeline and problems point at, in order. */
function traceRefs(data: PersonData): Map<string, string> {
  const ids: string[] = [];
  for (const row of data.timeline.rows) {
    if (row.kind !== 'elided') ids.push(row.traceId);
  }
  for (const problem of data.problems) ids.push(problem.traceId);
  const unique = [...new Set(ids)];
  return new Map(unique.map((traceId, index) => [traceId, `t${index + 1}`]));
}

function traceLines(data: PersonData): string[] {
  const refs = traceRefs(data);
  const byId = new Map(data.traces.map((trace) => [trace.traceId, trace]));
  const listed = [...refs.keys()].flatMap((id) => byId.get(id) ?? []);
  const shown = listed.slice(0, TRACE_CAP);
  const lines = [
    `TRACES (${shown.length} of ${data.traces.length}; t# is the timeline's trace column)`,
  ];
  for (const trace of shown) {
    lines.push(
      `${refs.get(trace.traceId) ?? ''} ${trace.traceId} ${trace.rootName} ${trace.startedAtUtc.slice(11, 19)}Z ${trace.spanCount} spans, db ${trace.dbMs}ms in ${trace.dbQueries} queries, ${trace.errorCount} errors, via ${trace.via}`
    );
  }
  const hidden = data.traces.length - shown.length;
  if (hidden > 0) {
    lines.push(
      `… ${hidden} more traces, none with a row above or a problem; all of them: add --json`
    );
  }
  return lines;
}

function stampOf(local: string, utc: string, data: PersonData): string {
  const zone = data.clock?.zoneLabel ?? 'UTC';
  const dated = crossesDays(data);
  const cut = (iso: string) =>
    dated ? `${iso.slice(5, 10)} ${iso.slice(11, 19)}` : iso.slice(11, 19);
  return zone === 'UTC'
    ? `${cut(utc)}Z`
    : `${cut(local)} ${zone}  ${cut(utc)}Z`;
}

function crossesDays(data: PersonData): boolean {
  if (data.window === undefined || data.clock === undefined) return false;
  const shift = (iso: string) =>
    new Date(Date.parse(iso) + (data.clock?.offsetMinutes ?? 0) * 60_000)
      .toISOString()
      .slice(0, 10);
  return (
    data.window.startUtc.slice(0, 10) !== data.window.endUtc.slice(0, 10) ||
    shift(data.window.startUtc) !== shift(data.window.endUtc)
  );
}

function invalidClock(data: PersonData): string[] {
  return [
    `The time ${JSON.stringify(data.question.at)} needs a zone, for example "6:33pm MST".`,
    ...data.next.map((next) => `next: ${next}`),
  ];
}

function notFound(data: PersonData): string[] {
  return [
    `No account is named ${JSON.stringify(data.question.name)}; nothing was searched in telemetry.`,
    ...data.next.map((next) => `next: ${next}`),
  ];
}

function quiet(data: PersonData): string[] {
  const name = data.question.name;
  const { last, next } = data.seen ?? {};
  const ids = data.accounts.map((account) => account.userId).join(', ');
  const lines = [
    `Nothing happened for ${name} at that time. No trace in this window carried user.id ${ids}, or a session or device seen on it.`,
  ];
  if (last === undefined && next === undefined) {
    lines.push(
      `The account exists but has no telemetry within 7d either side of the window.`
    );
  }
  if (last !== undefined) lines.push(...seenLines('last seen', last, data));
  if (next !== undefined) lines.push(...seenLines('next seen', next, data));
  const printed = new Set([last?.rerun, next?.rerun]);
  lines.push(
    ...data.next
      .filter((entry) => !printed.has(entry))
      .map((entry) => `next: ${entry}`)
  );
  return lines;
}

function seenLines(label: string, seen: SeenAt, data: PersonData): string[] {
  const zone = data.clock?.zoneLabel ?? 'UTC';
  const distance = humanSpan(seen.offsetMs);
  const relation = seen.offsetMs < 0 ? 'before' : 'after';
  return [
    `${label}: ${seen.atLocal.slice(0, 19).replace('T', ' ')} ${zone} / ${seen.atUtc.slice(0, 19).replace('T', ' ')}Z (${distance} ${relation} the asked time) trace ${seen.traceId}`,
    `next: ${seen.rerun}`,
  ];
}
