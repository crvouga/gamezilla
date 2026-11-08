import type { CDPSession, Page, TestInfo } from '@playwright/test';

type TraceEvent = {
  name: string;
  ph: string;
  dur?: number;
  tid: number;
};

type CallFrame = {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
};

type ProfileNode = { id: number; callFrame: CallFrame; children?: number[] };

type Profile = {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
};

const MAIN_THREAD_WORK = [
  'FunctionCall',
  'EventDispatch',
  'FireAnimationFrame',
  'TimerFire',
  'RunMicrotasks',
  'UpdateLayoutTree',
  'Layout',
  'PrePaint',
  'Paint',
  'Layerize',
  'UpdateLayer',
  'Commit',
  'MajorGC',
  'MinorGC',
  'ParseHTML',
];

function frameKey(frame: CallFrame): string {
  const file = frame.url.split('/').pop()?.split('?')[0] ?? '';
  return `${frame.functionName || '(anonymous)'} ${file}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
}

/** Self and inclusive milliseconds per function, and who calls each one. */
function attribute(profile: Profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map<number, number>();
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parent.set(child, node.id);
  const self = new Map<string, number>();
  const total = new Map<string, number>();
  const callers = new Map<string, Map<string, number>>();
  profile.samples.forEach((id, index) => {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    const leaf = nodes.get(id);
    if (!leaf) return;
    const key = frameKey(leaf.callFrame);
    self.set(key, (self.get(key) ?? 0) + ms);
    const seen = new Set<string>();
    const chain: string[] = [];
    for (
      let at: number | undefined = id;
      at !== undefined;
      at = parent.get(at)
    ) {
      const frame = nodes.get(at)?.callFrame;
      if (!frame) break;
      const each = frameKey(frame);
      if (!seen.has(each)) total.set(each, (total.get(each) ?? 0) + ms);
      seen.add(each);
      if (chain.length < 8) chain.push(each);
    }
    const path = chain.slice(1).join(' < ');
    const byPath = callers.get(key) ?? new Map<string, number>();
    byPath.set(path, (byPath.get(path) ?? 0) + ms);
    callers.set(key, byPath);
  });
  return { self, total, callers };
}

function round(entries: [string, number][]): Record<string, number> {
  return Object.fromEntries(
    entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, ms]) => [name, Math.round(ms * 10) / 10])
  );
}

/** The minified bundles name nothing, so name each hot function by its own source. */
async function excerpts(
  page: Page,
  frames: (readonly [string, CallFrame])[]
): Promise<Record<string, string>> {
  return page.evaluate(async (list) => {
    const texts = new Map<string, string>();
    const out: Record<string, string> = {};
    for (const [key, frame] of list) {
      if (!frame.url.startsWith(location.origin)) continue;
      if (!texts.has(frame.url))
        texts.set(frame.url, await (await fetch(frame.url)).text());
      const line = texts.get(frame.url)?.split('\n')[frame.lineNumber] ?? '';
      out[key] = line.slice(
        Math.max(0, frame.columnNumber - 120),
        frame.columnNumber + 360
      );
    }
    return out;
  }, frames);
}

async function record(
  page: Page,
  cdp: CDPSession,
  ticks: number
): Promise<{ events: TraceEvent[]; profile: Profile; windowMs: number }> {
  const events: TraceEvent[] = [];
  cdp.on('Tracing.dataCollected', (event) => {
    events.push(...(event.value as unknown as TraceEvent[]));
  });
  const complete = new Promise<void>((resolve) =>
    cdp.once('Tracing.tracingComplete', () => resolve())
  );
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
  });
  const windowMs = await page.evaluate(async (count) => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing story root');
    const start = performance.now();
    for (let tick = 0; tick < count; tick++) {
      root.dispatchEvent(
        new CustomEvent('advance-story-time', { detail: 1000 / 30 })
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    }
    return performance.now() - start;
  }, ticks);
  await cdp.send('Tracing.end');
  await complete;
  const { profile } = (await cdp.send('Profiler.stop')) as {
    profile: Profile;
  };
  await cdp.send('Profiler.disable');
  return { events, profile, windowMs };
}

/**
 * Where the main thread spends a short throttled motion window: Chrome's
 * timeline totals, the sampled functions by self and inclusive time, and
 * the callers and source of the hottest. It runs in its own window, never
 * inside a measured one, because tracing adds cost.
 */
export async function profileMotion(
  page: Page,
  cdp: CDPSession,
  info: TestInfo,
  ticks: number
): Promise<void> {
  const { events, profile, windowMs } = await record(page, cdp, ticks);
  const totals = new Map<string, number>();
  for (const event of events)
    if (event.ph === 'X' && event.dur && MAIN_THREAD_WORK.includes(event.name))
      totals.set(event.name, (totals.get(event.name) ?? 0) + event.dur / 1000);
  const { self, total, callers } = attribute(profile);
  const hottest = [...self]
    .filter(([key]) => !key.startsWith('('))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const frames = new Map(
    profile.nodes.map((node) => [frameKey(node.callFrame), node.callFrame])
  );
  const sources = await excerpts(
    page,
    hottest.flatMap(([key]) => {
      const frame = frames.get(key);
      return frame ? [[key, frame] as const] : [];
    })
  );
  await info.attach('main-thread-profile.json', {
    body: JSON.stringify(
      {
        test: info.title,
        ticks,
        windowMs: Math.round(windowMs),
        timelineMs: round([...totals]),
        selfTimeMs: round([...self].sort((a, b) => b[1] - a[1]).slice(0, 40)),
        totalTimeMs: round([...total].sort((a, b) => b[1] - a[1]).slice(0, 40)),
        hottest: hottest.map(([key, ms]) => ({
          key,
          selfMs: Math.round(ms * 10) / 10,
          callers: round(
            [...(callers.get(key) ?? new Map<string, number>())]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
          ),
          source: sources[key] ?? null,
        })),
        limits:
          'Diagnostic only: tracing and sampling add overhead, so this window is separate from the measured sustained window and its absolute times are not comparable with it. Timeline totals can nest (a FunctionCall contains its callees); compare categories, not sums. Under CPU throttling, suspended time is sampled as (program), so (program) is mostly throttle, not work.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}
