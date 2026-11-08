import type { CDPSession, Page, TestInfo } from '@playwright/test';

type TraceEvent = {
  name: string;
  ph: string;
  dur?: number;
  tid: number;
  args?: { data?: { frame?: string } };
};

type ProfileNode = {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
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

/**
 * Where the main thread spends a short throttled motion window: Chrome's
 * timeline totals and the sampled functions with the most self time. It runs
 * in its own window, never inside a measured one, because tracing adds cost.
 */
export async function profileMotion(
  page: Page,
  cdp: CDPSession,
  info: TestInfo,
  ticks: number
): Promise<void> {
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
    profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
  };
  await cdp.send('Profiler.disable');
  const totals = new Map<string, number>();
  for (const event of events)
    if (event.ph === 'X' && event.dur && MAIN_THREAD_WORK.includes(event.name))
      totals.set(event.name, (totals.get(event.name) ?? 0) + event.dur / 1000);
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map<string, number>();
  profile.samples.forEach((id, index) => {
    const frame = nodes.get(id)?.callFrame;
    if (!frame) return;
    const file = frame.url.split('/').pop()?.split('?')[0] ?? '';
    const key = `${frame.functionName || '(anonymous)'} ${file}:${frame.lineNumber + 1}`;
    self.set(
      key,
      (self.get(key) ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000
    );
  });
  const round = (entries: [string, number][]) =>
    Object.fromEntries(
      entries
        .sort((a, b) => b[1] - a[1])
        .map(([name, ms]) => [name, Math.round(ms * 10) / 10])
    );
  await info.attach('main-thread-profile.json', {
    body: JSON.stringify(
      {
        test: info.title,
        ticks,
        windowMs: Math.round(windowMs),
        timelineMs: round([...totals]),
        selfTimeMs: round([...self].sort((a, b) => b[1] - a[1]).slice(0, 40)),
        limits:
          'Diagnostic only: tracing and sampling add overhead, so this window is separate from the measured sustained window and its absolute times are not comparable with it. Timeline totals can nest (a FunctionCall contains its callees); compare categories, not sums.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}
