// @io-wall-ok — browser trace diagnosis, never product timing.
import type { CDPSession } from '@playwright/test';

/** One Chromium trace event, as `Tracing.dataCollected` reports it. */
export type TraceEvent = {
  name: string;
  ph: string;
  pid: number;
  tid: number;
  ts: number;
  dur?: number;
  tdur?: number;
  args?: {
    name?: string;
    data?: {
      functionName?: string;
      url?: string;
      startTime?: number;
      cpuProfile?: {
        nodes?: {
          id: number;
          // Chrome leaves `url` out for frames with no script, such as
          // `(program)`, `(idle)` and `(garbage collector)`.
          callFrame: {
            functionName?: string;
            url?: string;
            lineNumber?: number;
          };
        }[];
        samples?: number[];
      };
      timeDeltas?: number[];
    };
  };
  id?: string;
};

export type LongTaskBreakdown = {
  /** Wall time of the main-thread task, in ms. */
  wallMs: number;
  /** CPU time the thread actually ran inside it, in ms. */
  threadMs: number | null;
  /** Nested trace events inside it, total wall ms by name. */
  events: [string, number][];
  /** CPU profile samples inside it, self time ms by function. */
  selfTime: [string, number][];
};

const TOP = 12;
const round = (ms: number) => Math.round(ms * 10) / 10;

function eventLabel(event: TraceEvent): string {
  const data = event.args?.data;
  if (event.name === 'FunctionCall' && data)
    return `FunctionCall ${data.functionName ?? ''} ${(data.url ?? '').split('/').pop() ?? ''}`;
  return event.name;
}

function top(totals: Map<string, number>): [string, number][] {
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, micros]) => [name, round(micros / 1000)]);
}

/** A profiled frame's name, with its file and line when it ran a script. */
function frameLabel(frame: {
  functionName?: string;
  url?: string;
  lineNumber?: number;
}): string {
  const name = frame.functionName || '(anonymous)';
  const file = frame.url ? frame.url.split('/').pop() : undefined;
  return file ? `${name} ${file}:${(frame.lineNumber ?? 0) + 1}` : name;
}

/** CPU samples per renderer thread, at trace timestamps. */
function cpuSamples(events: readonly TraceEvent[]) {
  const profiles = new Map<
    string,
    {
      pid: number;
      tid: number;
      time: number;
      frames: Map<number, string>;
      samples: { ts: number; frame: string }[];
    }
  >();
  for (const event of events) {
    const key = `${event.pid}:${event.id ?? ''}`;
    const data = event.args?.data;
    if (event.name === 'Profile' && data?.startTime !== undefined)
      profiles.set(key, {
        pid: event.pid,
        tid: event.tid,
        time: data.startTime,
        frames: new Map(),
        samples: [],
      });
    if (event.name !== 'ProfileChunk' || !data) continue;
    const profile = profiles.get(key);
    if (!profile) continue;
    for (const node of data.cpuProfile?.nodes ?? []) {
      profile.frames.set(node.id, frameLabel(node.callFrame));
    }
    const ids = data.cpuProfile?.samples ?? [];
    ids.forEach((id, index) => {
      profile.time += data.timeDeltas?.[index] ?? 0;
      profile.samples.push({
        ts: profile.time,
        frame: profile.frames.get(id) ?? `node ${id}`,
      });
    });
  }
  return [...profiles.values()];
}

/**
 * Every renderer main-thread task of at least `minimumMs`, with what ran
 * inside it: its CPU time against its wall time (a gap is time the thread was
 * descheduled), the nested trace events and the CPU samples.
 */
export function summarizeLongTasks(
  events: readonly TraceEvent[],
  minimumMs = 50
): LongTaskBreakdown[] {
  const mainThreads = new Set(
    events
      .filter(
        (event) =>
          event.ph === 'M' &&
          event.name === 'thread_name' &&
          event.args?.name === 'CrRendererMain'
      )
      .map((event) => `${event.pid}:${event.tid}`)
  );
  const onMain = (event: TraceEvent) =>
    mainThreads.has(`${event.pid}:${event.tid}`);
  const tasks = events.filter(
    (event) =>
      onMain(event) &&
      event.ph === 'X' &&
      (event.name === 'RunTask' ||
        event.name === 'ThreadControllerImpl::RunTask') &&
      (event.dur ?? 0) >= minimumMs * 1000
  );
  const profiles = cpuSamples(events);
  return tasks.map((task) => ({
    wallMs: round((task.dur ?? 0) / 1000),
    threadMs: task.tdur === undefined ? null : round(task.tdur / 1000),
    events: top(nestedEvents(task, events)),
    selfTime: top(sampledSelfTime(task, profiles)),
  }));
}

function within(task: TraceEvent, event: TraceEvent): boolean {
  return (
    event !== task &&
    event.pid === task.pid &&
    event.tid === task.tid &&
    event.ph === 'X' &&
    event.ts >= task.ts &&
    event.ts + (event.dur ?? 0) <= task.ts + (task.dur ?? 0)
  );
}

function nestedEvents(task: TraceEvent, events: readonly TraceEvent[]) {
  const totals = new Map<string, number>();
  for (const event of events) {
    if (!within(task, event)) continue;
    const label = eventLabel(event);
    totals.set(label, (totals.get(label) ?? 0) + (event.dur ?? 0));
  }
  return totals;
}

function sampledSelfTime(
  task: TraceEvent,
  profiles: ReturnType<typeof cpuSamples>
) {
  const start = task.ts;
  const end = task.ts + (task.dur ?? 0);
  const self = new Map<string, number>();
  for (const profile of profiles) {
    if (profile.pid !== task.pid) continue;
    let previous: number | undefined;
    for (const sample of profile.samples) {
      if (sample.ts >= start && sample.ts <= end && previous !== undefined)
        self.set(
          sample.frame,
          (self.get(sample.frame) ?? 0) + (sample.ts - previous)
        );
      previous = sample.ts;
    }
  }
  return self;
}

const CATEGORIES = [
  'toplevel',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'v8',
  'v8.execute',
  'disabled-by-default-v8.gc',
  'disabled-by-default-v8.cpu_profiler',
  'blink.user_timing',
];

/** Records a Chromium trace around `run`; resolves with its events. */
export async function traceWindow(
  cdp: CDPSession,
  run: () => Promise<void>
): Promise<TraceEvent[]> {
  const events: TraceEvent[] = [];
  const collect = (payload: { value: object[] }) => {
    events.push(...(payload.value as TraceEvent[]));
  };
  cdp.on('Tracing.dataCollected', collect);
  const complete = new Promise<void>((resolve) => {
    cdp.once('Tracing.tracingComplete', () => resolve());
  });
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: CATEGORIES },
  });
  try {
    await run();
  } finally {
    await cdp.send('Tracing.end');
    await complete;
    cdp.off('Tracing.dataCollected', collect);
  }
  return events;
}
