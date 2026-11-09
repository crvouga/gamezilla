// @io-wall-ok — wall timings are measured only in this browser evidence adapter.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { logSummary } from './log-evidence';

type Samples = {
  frames: number[];
  inputs: number[];
  longTasks: number[];
  /** Frames over 50ms with the scripts that ran in them (Chromium LoAF). */
  longFrames: {
    duration: number;
    blocking: number;
    scripts: { invoker: string; source: string; duration: number }[];
  }[];
  /** Time inside the page's input handlers, bracketed at window capture/bubble. */
  handlers: number[];
  /** Input to the first change of a controlled paddle's drawn position. */
  inputToPaddle: number[];
  addedNodes: number;
  removedNodes: number;
};
type MetricsWindow = Window & { pongMetrics?: () => Samples };

/** Frame and long-task observations plus event-to-two-animation-frames proxy. */
export async function startPongMetrics(page: Page) {
  await page.evaluate(() => {
    const samples: Samples = {
      frames: [],
      inputs: [],
      longTasks: [],
      longFrames: [],
      handlers: [],
      inputToPaddle: [],
      addedNodes: 0,
      removedNodes: 0,
    };
    let running = true;
    let previous = performance.now();
    const frame = (time: number) => {
      if (!running) return;
      samples.frames.push(time - previous);
      previous = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    let pending: number | undefined;
    let handlerStart = 0;
    const handlerBegin = () => {
      handlerStart = performance.now();
    };
    const handlerEnd = () => {
      samples.handlers.push(performance.now() - handlerStart);
    };
    // Only input that can move a paddle: a paddle key, a press, or a drag
    // with a button held. A hover or another key moves nothing, so timing it
    // would charge the wait for a later press to the court.
    const paddleKeys = new Set(['arrowup', 'arrowdown', 'w', 's']);
    const input = (event: Event) => {
      if (
        (event instanceof KeyboardEvent &&
          !paddleKeys.has(event.key.toLowerCase())) ||
        (event instanceof PointerEvent &&
          event.type === 'pointermove' &&
          event.buttons === 0)
      )
        return;
      const start = performance.now();
      pending ??= start;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          samples.inputs.push(performance.now() - start);
        })
      );
    };
    const court = document.querySelector('[data-component="PaddleCourt"]');
    if (!court) throw new Error('Missing Pong court');
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.type === 'attributes' &&
          pending !== undefined &&
          record.target instanceof Element &&
          record.target.getAttribute('data-controlled') === 'true'
        ) {
          samples.inputToPaddle.push(performance.now() - pending);
          pending = undefined;
        }
        // Rebuilt drawing is churn; a status appearing over the court is not.
        if (record.target instanceof Element && record.target.closest('svg')) {
          samples.addedNodes += record.addedNodes.length;
          samples.removedNodes += record.removedNodes.length;
        }
      }
    });
    mutations.observe(court, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['y'],
    });
    for (const type of ['keydown', 'pointermove']) {
      window.addEventListener(type, handlerBegin, { capture: true });
      // Solid delegates to document; Storybook's own window key handler follows.
      document.addEventListener(type, handlerEnd);
    }
    court.addEventListener('keydown', input);
    court.addEventListener('pointerdown', input);
    court.addEventListener('pointermove', input);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        samples.longTasks.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });
    type LoafScript = {
      invoker: string;
      sourceURL: string;
      sourceFunctionName: string;
      duration: number;
    };
    const frameObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        blockingDuration: number;
        scripts: LoafScript[];
      })[])
        samples.longFrames.push({
          duration: Math.round(entry.duration),
          blocking: Math.round(entry.blockingDuration),
          scripts: [...entry.scripts]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 3)
            .map((script) => ({
              invoker: script.invoker.slice(0, 60),
              source:
                `${script.sourceURL.split('/').pop() ?? ''}:${script.sourceFunctionName}`.slice(
                  0,
                  80
                ),
              duration: Math.round(script.duration),
            })),
        });
    });
    if (
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
    )
      frameObserver.observe({ type: 'long-animation-frame' });
    (window as MetricsWindow).pongMetrics = () => {
      running = false;
      observer.disconnect();
      frameObserver.disconnect();
      mutations.disconnect();
      court.removeEventListener('keydown', input);
      court.removeEventListener('pointerdown', input);
      court.removeEventListener('pointermove', input);
      for (const type of ['keydown', 'pointermove']) {
        window.removeEventListener(type, handlerBegin, { capture: true });
        document.removeEventListener(type, handlerEnd);
      }
      return samples;
    };
  });
}

export async function finishPongMetrics(
  page: Page,
  info: TestInfo,
  cpuRate: number
) {
  const samples = await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const stop = (window as MetricsWindow).pongMetrics;
    if (!stop) throw new Error('Pong metrics were not started');
    return stop();
  });
  expect(samples.inputs.length).toBeGreaterThanOrEqual(24);
  const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  };
  const summary = {
    test: info.title,
    viewport: page.viewportSize(),
    cpuRate,
    inputs: samples.inputs.length,
    inputToPaddleP50: percentile(samples.inputToPaddle, 0.5),
    inputToPaddleP95: percentile(samples.inputToPaddle, 0.95),
    handlerP50: percentile(samples.handlers, 0.5),
    handlerP95: percentile(samples.handlers, 0.95),
    twoFrameP95: percentile(samples.inputs, 0.95),
    frameP50: percentile(samples.frames, 0.5),
    frameP95: percentile(samples.frames, 0.95),
    longTasks: samples.longTasks,
    longFrames: samples.longFrames,
    drawingNodesAdded: samples.addedNodes,
    drawingNodesRemoved: samples.removedNodes,
  };
  // Readable from the hosted run's own log.
  logSummary('PONG_TIMING', summary);
  await info.attach('pong-responsiveness', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        cpuRate,
        viewport: page.viewportSize(),
        browser: page.context().browser()?.version(),
        samples,
        limits:
          'Chromium component fixture. handlers brackets page input handling from a window capture listener to a document bubble listener after the delegated Solid handler, excluding the Storybook window key forwarding; the Storybook highlight addon is disabled because production pages never run it. inputToPaddle is input that can move a paddle (a paddle key, a press, or a drag with a button held) to the first controlled-paddle position mutation, before paint. Two-animation-frame proxy excludes hardware touch latency, display scanout, continuous production simulation and network latency. CPU throttling is not a physical low-end device.',
      },
      null,
      2
    ),
  });
  // Budgets: a paddle follows input within two frames (three under 4x CPU
  // throttling), no long task blocks play, and frames move the existing court
  // drawings instead of rebuilding them.
  const frames = cpuRate === 1 ? 2 : 3;
  expect(samples.inputToPaddle.length).toBeGreaterThanOrEqual(24);
  expect(summary.inputToPaddleP95 ?? Infinity).toBeLessThanOrEqual(
    frames * 16.7
  );
  expect(samples.longTasks).toEqual([]);
  expect([samples.addedNodes, samples.removedNodes]).toEqual([0, 0]);
}
