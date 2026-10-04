import type { NarrateSpan } from './narrate';
import { narrate } from './narrate';
import type { ResolvedIdentity } from './identity-resolver';
import { clockWindow, parseLocalClock } from './local-clock';
import type { LocalClock } from './local-clock';
import { placeFit, recordedDeviceTimeZone, recordedPlace } from './place';
import type { TimeRange, Trace, TraceRef, TraceStore } from './types';

const DEFAULT_WINDOW_MS = 30 * 60_000;
const TRACE_CAP = 20;

export type PersonDirectory = {
  resolvePeople(name: string): Promise<readonly ResolvedIdentity[]>;
};

export type PersonQuestion = {
  readonly name: string;
  readonly at: string;
  readonly nowMs: number;
  readonly place?: string;
  readonly windowMs?: number;
};

export type PersonTroubleReport = {
  readonly code: 0 | 1 | 2;
  readonly sawTrouble: boolean;
  readonly text: string;
  readonly userIds: readonly string[];
  readonly range?: TimeRange;
  readonly spanId?: string;
  readonly traceId?: string;
  /** The directory is missing. The caller says how to provide it. */
  readonly unavailable?: boolean;
};

type Loaded = {
  readonly ref: TraceRef;
  readonly trace: Trace;
  readonly userId: string;
};

type Selection = {
  readonly connection?: string;
  readonly deviceZone?: string;
  readonly placeMatched: boolean;
  readonly traces: readonly Loaded[];
};

type ReportParts = {
  readonly clock: LocalClock;
  readonly name: string;
  readonly people: readonly ResolvedIdentity[];
  readonly place?: string;
  readonly range?: TimeRange;
  readonly selected?: Selection;
  readonly store: TraceStore;
};

/** Find what went wrong for a person from their name, place, and own clock. */
export async function findPersonTrouble(
  store: TraceStore,
  directory: PersonDirectory | undefined,
  question: PersonQuestion
): Promise<PersonTroubleReport> {
  if (directory === undefined) return unavailable();
  const clock = parseLocalClock(question.at, question.nowMs);
  if (clock === undefined) return badClock(question.at);
  const people = await directory.resolvePeople(question.name);
  const parts = {
    store,
    name: question.name,
    clock,
    people,
    ...(question.place === undefined ? {} : { place: question.place }),
  };
  if (people.length === 0) return missed(parts);
  const range = clockWindow(clock, question.windowMs ?? DEFAULT_WINDOW_MS);
  const loaded = await loadTraces(store, people, range);
  const selected = selectByPlace(loaded, question.place);
  if (!hasError(selected.traces)) return missed({ ...parts, range });
  return trouble({ ...parts, range, selected });
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

function badClock(at: string): PersonTroubleReport {
  return {
    code: 2,
    sawTrouble: false,
    text: [
      'obs/v1',
      `The time ${JSON.stringify(at)} needs a zone, for example "6:33pm MST".`,
      'next: bun obs person --name "<name>" --at "6:33pm MST"',
    ].join('\n'),
    userIds: [],
  };
}

function missed(parts: ReportParts): PersonTroubleReport {
  const { store, name, clock, people } = parts;
  const range = parts.range;
  return {
    code: 1,
    sawTrouble: false,
    text: [
      'obs/v1',
      `source: ${store.source}`,
      ...(range === undefined
        ? []
        : [`utc-range: ${iso(range.startMs)} .. ${iso(range.endMs)}`]),
      ...personLines(
        name,
        people,
        people.map((person) => person.userId)
      ),
      `clock: ${clock.label} = ${iso(clock.instantMs)}`,
      `Nothing happened for ${name} at that time.`,
      'next: bun obs last --window 30m',
    ].join('\n'),
    userIds: people.map((person) => person.userId),
    ...(range === undefined ? {} : { range }),
  };
}

async function loadTraces(
  store: TraceStore,
  people: readonly ResolvedIdentity[],
  range: TimeRange
): Promise<Loaded[]> {
  const byTrace = new Map<
    string,
    { readonly userId: string; readonly ref: TraceRef }
  >();
  for (const person of people) {
    for (const ref of await store.findByUser(person.userId, range)) {
      remember(byTrace, person.userId, ref);
    }
  }
  const ordered = [...byTrace.values()]
    .sort(
      (left, right) =>
        right.ref.errorCount - left.ref.errorCount ||
        left.ref.startedAtMs - right.ref.startedAtMs
    )
    .slice(0, TRACE_CAP);
  const loaded: Loaded[] = [];
  for (const item of ordered) {
    const trace = await store.getTrace(item.ref.traceId);
    if (trace !== null)
      loaded.push({ userId: item.userId, trace, ref: item.ref });
  }
  return loaded;
}

function remember(
  byTrace: Map<string, { readonly userId: string; readonly ref: TraceRef }>,
  userId: string,
  ref: TraceRef
): void {
  const existing = byTrace.get(ref.traceId);
  if (existing === undefined || ref.errorCount > existing.ref.errorCount) {
    byTrace.set(ref.traceId, { userId, ref });
  }
}

function selectByPlace(
  loaded: readonly Loaded[],
  place: string | undefined
): Selection {
  const asked = place?.trim() ?? '';
  const connection = firstRecorded(loaded, recordedPlace);
  const deviceZone = firstRecorded(loaded, recordedDeviceTimeZone);
  if (asked.length === 0) {
    return selection(loaded, true, connection, deviceZone);
  }
  const hits = bestPlaceHits(loaded, asked);
  if (hits.length === 0) {
    return selection(loaded, false, connection, deviceZone);
  }
  const users = new Set(hits.map((item) => item.userId));
  const traces = loaded.filter((item) => users.has(item.userId));
  return selection(
    traces,
    true,
    firstRecorded(traces, recordedPlace) ?? connection,
    firstRecorded(traces, recordedDeviceTimeZone) ?? deviceZone
  );
}

function selection(
  traces: readonly Loaded[],
  placeMatched: boolean,
  connection: string | undefined,
  deviceZone: string | undefined
): Selection {
  return {
    traces,
    placeMatched,
    ...(connection === undefined ? {} : { connection }),
    ...(deviceZone === undefined ? {} : { deviceZone }),
  };
}

function bestPlaceHits(loaded: readonly Loaded[], asked: string): Loaded[] {
  const fitting = loaded.filter((item) => traceFit(item, asked) > 0);
  const city = fitting.filter((item) => traceFit(item, asked) === 2);
  return city.length > 0 ? city : fitting;
}

function traceFit(item: Loaded, asked: string): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const span of item.trace.spans) {
    const recorded = recordedPlace(span.attributes);
    if (recorded === undefined) continue;
    const fit = placeFit(asked, recorded);
    if (fit > best) best = fit;
  }
  return best;
}

function trouble(parts: ReportParts): PersonTroubleReport {
  const selected = parts.selected ?? { traces: [], placeMatched: false };
  const range = parts.range ?? {
    startMs: parts.clock.instantMs,
    endMs: parts.clock.instantMs,
  };
  const error = firstError(selected.traces);
  const userIds = [...new Set(selected.traces.map((item) => item.userId))];
  const filled = { ...parts, selected, range };
  return {
    code: 0,
    sawTrouble: true,
    text: renderTrouble(filled, userIds),
    range,
    userIds,
    ...(error === undefined
      ? {}
      : { traceId: error.traceId, spanId: error.spanId }),
  };
}

function renderTrouble(parts: ReportParts, userIds: readonly string[]): string {
  const selected = parts.selected ?? { traces: [], placeMatched: false };
  const range = parts.range ?? {
    startMs: parts.clock.instantMs,
    endMs: parts.clock.instantMs,
  };
  const error = firstError(selected.traces);
  return [
    'obs/v1',
    `source: ${parts.store.source}`,
    `utc-range: ${iso(range.startMs)} .. ${iso(range.endMs)}`,
    ...personLines(parts.name, parts.people, userIds),
    `clock: ${parts.clock.label} = ${iso(parts.clock.instantMs)}`,
    `connection: ${selected.connection ?? 'not recorded'}`,
    `device-clock: ${selected.deviceZone ?? 'not recorded'}`,
    placeLine(parts, selected),
    '',
    error === undefined
      ? 'No error was recorded.'
      : narrate([error], { maxLines: 24 }),
    nextLine(error, selected),
  ].join('\n');
}

function personLines(
  name: string,
  people: readonly ResolvedIdentity[],
  kept: readonly string[]
): string[] {
  const shown = people.filter((person) => kept.includes(person.userId));
  const lines = shown.map(
    (person) => `person: ${name} -> user.id ${person.userId}`
  );
  if (people.length > 1) {
    lines.push(
      `people: ${people.length} share this name; ${shown.length} match this place and time`
    );
  }
  return lines;
}

function placeLine(parts: ReportParts, selected: Selection): string {
  const asked = parts.place?.trim() ?? '';
  if (asked.length === 0) return 'place: not asked';
  if (selected.placeMatched) return `place: matched ${asked}`;
  const where = selected.connection ?? 'an unrecorded place';
  return `place: asked ${asked}; connection appeared at ${where}`;
}

function hasError(traces: readonly Loaded[]): boolean {
  return traces.some((item) =>
    item.trace.spans.some((span) => span.status === 'error')
  );
}

function firstError(traces: readonly Loaded[]): NarrateSpan | undefined {
  for (const item of traces) {
    const span = item.trace.spans.find(
      (candidate) => candidate.status === 'error'
    );
    if (span !== undefined) return span;
  }
  return undefined;
}

function firstRecorded(
  traces: readonly Loaded[],
  read: (attributes: NarrateSpan['attributes']) => string | undefined
): string | undefined {
  for (const item of traces) {
    for (const span of item.trace.spans) {
      const value = read(span.attributes);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function nextLine(error: NarrateSpan | undefined, selected: Selection): string {
  if (error !== undefined)
    return `next: bun obs span ${error.traceId} ${error.spanId}`;
  const traceId = selected.traces[0]?.trace.traceId ?? '';
  return `next: bun obs trace ${traceId}`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}
