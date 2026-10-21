import type { ResolvedIdentity } from './identity-resolver';
import type { LocalClock } from './local-clock';
import { clockWindow, parseLocalClock } from './local-clock';
import type { NarrateSpan } from './narrate';
import type { Gathered } from './person-activity';
import { gatherActivity } from './person-activity';
import type { PlaceSelection } from './person-place';
import { selectByPlace } from './person-place';
import { describeProblem, findProblems } from './person-problems';
import type { RenderFlags } from './person-render';
import { renderPerson } from './person-render';
import type { RerunQuestion } from './person-rerun';
import { rerunCommand, widerWindowMs } from './person-rerun';
import { lookOutward } from './person-seen';
import { spansInWindow, summarize, summarizeTraces } from './person-summary';
import { atText, localIso, utcIso } from './person-time';
import type { TimelineEntry } from './person-timeline';
import {
  capRows,
  DEFAULT_ROW_CAP,
  DEFAULT_SLOW_MS,
  isGap,
  timelineRows,
} from './person-timeline';
import type {
  PersonAccount,
  PersonData,
  TimelineGapData,
  TimelineRow,
  TimelineRowData,
} from './person-types';
import { PERSON_SCHEMA } from './person-types';
import type { TimeRange, TraceStore, TruncationNotice } from './types';

const DEFAULT_WINDOW_MS = 30 * 60_000;
/** Traces read for each search; `--all` raises it. */
const TRACE_LIMIT = 200;
const TRACE_LIMIT_ALL = 1_000;

export type PersonDirectory = {
  resolvePeople(name: string): Promise<readonly ResolvedIdentity[]>;
};

export type PersonQuestion = {
  /** Print every problem and timeline row, and read more traces. */
  readonly all?: boolean;
  readonly at: string;
  readonly name: string;
  readonly nowMs: number;
  readonly place?: string;
  /** Rows to print before eliding; defaults to a screenful. */
  readonly rowCap?: number;
  /**
   * How the caller asks the same question again, for callers whose follow-up
   * is not `bun obs person` (the MCP tool). Defaults to the CLI command.
   */
  readonly rerun?: (question: RerunQuestion) => string;
  /** The `--source` the caller used, repeated in the commands it prints. */
  readonly sourceFlag?: string;
  /** A span this long gets a timeline row of its own. */
  readonly slowMs?: number;
  readonly windowMs?: number;
};

export type PersonTroubleReport = {
  readonly code: 0 | 1 | 2;
  /** The structured report, the same facts as `text`. Absent without a directory. */
  readonly data?: PersonData;
  readonly range?: TimeRange;
  /** Some span of the person's activity recorded an error. */
  readonly sawTrouble: boolean;
  readonly spanId?: string;
  readonly text: string;
  readonly traceId?: string;
  /** The directory is missing. The caller says how to provide it. */
  readonly unavailable?: boolean;
  readonly userIds: readonly string[];
};

/** Everything a report is built from once the question has a clock. */
export type PersonAsk = PersonQuestion & { readonly clock: LocalClock };

/**
 * Reconstruct what happened to a person from their name, place and own clock:
 * every account of that name, the traces of each (and of the sessions and
 * devices seen on them), the problems first, then a chronological timeline.
 */
export async function findPersonTrouble(
  store: TraceStore,
  directory: PersonDirectory | undefined,
  question: PersonQuestion
): Promise<PersonTroubleReport> {
  if (directory === undefined) return unavailable();
  const clock = parseLocalClock(question.at, question.nowMs);
  if (clock === undefined) return badClock(store, question);
  const people = await directory.resolvePeople(question.name);
  return reportForAccounts(store, people, { ...question, clock });
}

/** The report for accounts that are already known, for callers with no directory. */
export async function reportForAccounts(
  store: TraceStore,
  people: readonly ResolvedIdentity[],
  ask: PersonAsk
): Promise<PersonTroubleReport> {
  if (people.length === 0) return missingAccount(store, ask);
  const range = clockWindow(ask.clock, ask.windowMs ?? DEFAULT_WINDOW_MS);
  const gathered = await gatherActivity(
    store,
    people.map((person) => person.userId),
    { range, limit: ask.all === true ? TRACE_LIMIT_ALL : TRACE_LIMIT }
  );
  const selection = selectByPlace(gathered.traces, people, ask.place);
  const spans = spansInWindow(selection.traces, range);
  const base = baseData(store, ask, range, selection.accounts);
  if (spans.length === 0)
    return quietReport(store, ask, { people, base, range });
  const data = activityData(base, ask, { gathered, selection, spans });
  return finish(data, ask, range, shownIds(selection.accounts));
}

type Found = {
  readonly gathered: Gathered;
  readonly selection: PlaceSelection;
  readonly spans: readonly NarrateSpan[];
};

/** Problems first, then the timeline, from the spans inside the window. */
function activityData(
  base: PersonData,
  ask: PersonAsk,
  found: Found
): PersonData {
  const { gathered, selection, spans } = found;
  const range = clockWindow(ask.clock, ask.windowMs ?? DEFAULT_WINDOW_MS);
  const problems = findProblems(selection.traces, range).map((item, index) =>
    describeProblem(item, index + 1, {
      zone: ask.clock,
      ...(ask.sourceFlag === undefined ? {} : { sourceFlag: ask.sourceFlag }),
    })
  );
  const rows = timelineRows(spans, { slowMs: ask.slowMs ?? DEFAULT_SLOW_MS });
  const capped = capRows(
    rows,
    ask.all === true
      ? Number.POSITIVE_INFINITY
      : (ask.rowCap ?? DEFAULT_ROW_CAP),
    ask.clock.instantMs
  );
  return {
    ...base,
    status: problems.length > 0 ? 'trouble' : 'activity',
    summary: {
      ...summarize(spans, selection.traces.length),
      ...(selection.connection === undefined
        ? {}
        : { connection: selection.connection }),
      ...(selection.deviceZone === undefined
        ? {}
        : { deviceClock: selection.deviceZone }),
    },
    problems,
    traces: summarizeTraces(selection.traces),
    truncations: gathered.notices.map(describeNotice),
    notes: foreignNotes(gathered),
    timeline: {
      total: rows.length,
      elided: capped.elided,
      rows: capped.entries.map((entry) => rowData(entry, ask.clock)),
    },
    next: nextCommands(problems, selection.traces[0]?.trace.traceId, ask),
  };
}

function foreignNotes(gathered: Gathered): string[] {
  return gathered.foreign === 0
    ? []
    : [
        `${gathered.foreign} traces on the same session or device belong to other accounts and are left out`,
      ];
}

function baseData(
  store: TraceStore,
  ask: PersonAsk,
  range: TimeRange,
  accounts: readonly PersonAccount[]
): PersonData {
  return {
    schema: PERSON_SCHEMA,
    status: 'activity',
    source: store.source,
    question: {
      name: ask.name,
      at: ask.at,
      windowMs: ask.windowMs ?? DEFAULT_WINDOW_MS,
      ...(ask.place === undefined ? {} : { place: ask.place }),
    },
    clock: clockData(ask.clock),
    window: { startUtc: utcIso(range.startMs), endUtc: utcIso(range.endMs) },
    accounts,
    problems: [],
    timeline: { total: 0, elided: 0, rows: [] },
    traces: [],
    truncations: [],
    notes: [],
    next: [],
  };
}

function clockData(clock: LocalClock): NonNullable<PersonData['clock']> {
  return {
    label: clock.label,
    instantUtc: utcIso(clock.instantMs),
    zone: clock.timeZone,
    zoneLabel: clock.zoneLabel,
    offsetMinutes: clock.offsetMinutes,
  };
}

function shownIds(accounts: readonly PersonAccount[]): string[] {
  return accounts
    .filter((account) => account.shown)
    .map((account) => account.userId);
}

function describeNotice(notice: TruncationNotice): string {
  const why =
    notice.reason === 'limit'
      ? `stopped at ${notice.kept} traces`
      : `one second still held more traces than Tempo returns, kept ${notice.kept}`;
  return `${notice.search}: ${why}; narrow --window or pass --all for more`;
}

function rowData(
  entry: TimelineEntry,
  zone: LocalClock
): TimelineRowData | TimelineGapData {
  if (isGap(entry)) return { kind: 'elided', elided: entry.elided };
  const row: TimelineRow = entry;
  return {
    kind: row.kind,
    atUtc: utcIso(row.atMs),
    atLocal: localIso(row.atMs, zone),
    summary: row.text,
    durationMs: Math.round(row.durationMs * 100) / 100,
    failed: row.failed,
    repeat: row.repeat,
    traceId: row.traceId,
    spanId: row.spanId,
    ...(row.repeat > 1 ? { untilUtc: utcIso(row.untilMs) } : {}),
  };
}

function command(ask: PersonAsk, change: Partial<RerunQuestion> = {}): string {
  const question = { ...asked(ask), ...change };
  return ask.rerun === undefined ? rerunCommand(question) : ask.rerun(question);
}

function asked(ask: PersonAsk): RerunQuestion {
  return {
    at: ask.at,
    name: ask.name,
    windowMs: ask.windowMs ?? DEFAULT_WINDOW_MS,
    ...(ask.place === undefined ? {} : { place: ask.place }),
    ...(ask.sourceFlag === undefined ? {} : { sourceFlag: ask.sourceFlag }),
  };
}

function nextCommands(
  problems: PersonData['problems'],
  firstTrace: string | undefined,
  ask: PersonAsk
): string[] {
  const first = problems[0];
  const drill =
    first !== undefined
      ? [first.drill.span]
      : firstTrace === undefined
        ? []
        : [
            `bun obs trace ${firstTrace}${ask.sourceFlag === undefined ? '' : ` --source ${ask.sourceFlag}`}`,
          ];
  return [
    ...drill,
    command(ask, {
      windowMs: widerWindowMs(ask.windowMs ?? DEFAULT_WINDOW_MS),
    }),
  ];
}

function flagsFor(ask: PersonAsk): RenderFlags {
  return {
    all: ask.all === true,
    showAll: command(ask, { all: true }),
    widen: command(ask, {
      windowMs: widerWindowMs(ask.windowMs ?? DEFAULT_WINDOW_MS),
    }),
  };
}

function finish(
  data: PersonData,
  ask: PersonAsk,
  range: TimeRange,
  userIds: readonly string[]
): PersonTroubleReport {
  const first = data.problems[0];
  return {
    code: 0,
    sawTrouble: data.problems.length > 0,
    text: renderPerson(data, flagsFor(ask)),
    data,
    range,
    userIds,
    ...(first === undefined
      ? {}
      : { traceId: first.traceId, spanId: first.spanId }),
  };
}

/** A window with nothing in it: where else the accounts were seen. */
async function quietReport(
  store: TraceStore,
  ask: PersonAsk,
  quiet: {
    readonly base: PersonData;
    readonly people: readonly ResolvedIdentity[];
    readonly range: TimeRange;
  }
): Promise<PersonTroubleReport> {
  const { base, people, range } = quiet;
  const seen = await lookOutward(
    store,
    people.map((person) => person.userId),
    {
      range,
      instantMs: ask.clock.instantMs,
      nowMs: ask.nowMs,
      zone: ask.clock,
      rerun: (atMs) => command(ask, { at: atText(atMs, ask.clock) }),
    }
  );
  const rerun = [seen.last, seen.next].flatMap((item) => item?.rerun ?? []);
  const data: PersonData = {
    ...base,
    status: 'quiet',
    seen,
    next: [
      ...rerun,
      command(ask, {
        windowMs: widerWindowMs(ask.windowMs ?? DEFAULT_WINDOW_MS),
      }),
    ],
  };
  return {
    code: 1,
    sawTrouble: false,
    text: renderPerson(data, flagsFor(ask)),
    data,
    range,
    userIds: people.map((person) => person.userId),
  };
}

function missingAccount(
  store: TraceStore,
  ask: PersonAsk
): PersonTroubleReport {
  const range = clockWindow(ask.clock, ask.windowMs ?? DEFAULT_WINDOW_MS);
  const data: PersonData = {
    ...baseData(store, ask, range, []),
    status: 'account-not-found',
    next: [
      command(ask, { name: '<username or email>' }),
      'bun obs last --window 30m',
    ],
  };
  return {
    code: 1,
    sawTrouble: false,
    text: renderPerson(data, flagsFor(ask)),
    data,
    range,
    userIds: [],
  };
}

function unavailable(): PersonTroubleReport {
  return {
    code: 2,
    sawTrouble: false,
    unavailable: true,
    text: '',
    userIds: [],
  };
}

function badClock(
  store: TraceStore,
  question: PersonQuestion
): PersonTroubleReport {
  const data: PersonData = {
    schema: PERSON_SCHEMA,
    status: 'invalid-clock',
    source: store.source,
    question: {
      name: question.name,
      at: question.at,
      windowMs: question.windowMs ?? DEFAULT_WINDOW_MS,
    },
    accounts: [],
    problems: [],
    timeline: { total: 0, elided: 0, rows: [] },
    traces: [],
    truncations: [],
    notes: [],
    next: ['bun obs person --name "<name>" --at "6:33pm MST"'],
  };
  return {
    code: 2,
    sawTrouble: false,
    data,
    text: renderPerson(data, { all: false, showAll: '', widen: '' }),
    userIds: [],
  };
}
