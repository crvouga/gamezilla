// @io-wall-ok — browser performance instrumentation, never product timing.
import type { Page } from '@playwright/test';
import { refuseTraceSnapshots } from './timing-trace';

export type Samples = {
  inputToFrameMs: number[];
  longTaskMs: number[];
  timeOrigin: number;
  inputs: { startTime: number; type: string; key: string | null }[];
  frames: { inputAt: number; countObservedAt: number; frameAt: number }[];
  longTasks: unknown[];
};

type TimingScope = {
  sokobanSamples?: Samples;
  stopSokobanTiming?: () => void;
};

// Self-contained because Playwright serializes this function into the page.
export function startSokobanTiming() {
  const counts = document.querySelector('[data-testid="sokoban-counts"]');
  if (!counts) throw new Error('Missing move count');
  // The preview forwards every keydown to Storybook's manager; that is
  // harness work, not the game's, so it is off while moves are timed.
  const previousKeydown = window.onkeydown;
  window.onkeydown = null;
  const samples: Samples = {
    inputToFrameMs: [],
    longTaskMs: [],
    timeOrigin: performance.timeOrigin,
    inputs: [],
    frames: [],
    longTasks: [],
  };
  const scope = window as unknown as TimingScope;
  scope.sokobanSamples = samples;
  let inputAt: number | undefined;
  const mark = (event: Event) => {
    inputAt = performance.now();
    samples.inputs.push({
      startTime: inputAt,
      type: event.type,
      key: event instanceof KeyboardEvent ? event.key : null,
    });
  };
  // A key or a pointer press starts the clock.
  document.addEventListener('keydown', mark, { capture: true });
  document.addEventListener('pointerdown', mark, { capture: true });
  const pendingFrames = new Set<number>();
  const mutations = new MutationObserver(() => {
    if (inputAt === undefined) return;
    const start = inputAt;
    const countObservedAt = performance.now();
    inputAt = undefined;
    const frame = requestAnimationFrame(() => {
      pendingFrames.delete(frame);
      const frameAt = performance.now();
      samples.inputToFrameMs.push(frameAt - start);
      samples.frames.push({ inputAt: start, countObservedAt, frameAt });
    });
    pendingFrames.add(frame);
  });
  mutations.observe(counts, {
    attributes: true,
    attributeFilter: ['data-moves'],
  });
  const tasks = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      samples.longTaskMs.push(entry.duration);
      // PerformanceLongTaskTiming.toJSON retains startTime, name and
      // TaskAttributionTiming entries, including iframe owner details.
      samples.longTasks.push(entry.toJSON());
    }
  });
  tasks.observe({ type: 'longtask', buffered: false });
  scope.stopSokobanTiming = () => {
    document.removeEventListener('keydown', mark, { capture: true });
    document.removeEventListener('pointerdown', mark, { capture: true });
    mutations.disconnect();
    tasks.disconnect();
    for (const frame of pendingFrames) cancelAnimationFrame(frame);
    pendingFrames.clear();
    window.onkeydown = previousKeydown;
    delete scope.stopSokobanTiming;
    delete scope.sokobanSamples;
  };
}

export function stopSokobanTiming() {
  (window as unknown as TimingScope).stopSokobanTiming?.();
}

export async function withSokobanTiming<T>(
  page: Pick<Page, 'evaluate'>,
  measure: () => Promise<T>
): Promise<T> {
  await page.evaluate(refuseTraceSnapshots);
  try {
    await page.evaluate(startSokobanTiming);
    return await measure();
  } finally {
    await page.evaluate(stopSokobanTiming);
  }
}
