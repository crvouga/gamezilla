// @io-wall-ok — browser timing is measured by the automated evidence adapter.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { attachHeartsText } from './attachments';

type Samples = {
  inputs: { event: string; milliseconds: number }[];
  longTasks: { start: number; milliseconds: number }[];
};
type MeasuredWindow = Window & { heartsSamples: Samples };

export async function startHeartsMetrics(page: Page) {
  await page.evaluate(() => {
    const samples: Samples = { inputs: [], longTasks: [] };
    (window as unknown as MeasuredWindow).heartsSamples = samples;
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries())
        samples.longTasks.push({
          start: entry.startTime,
          milliseconds: entry.duration,
        });
    });
    observer.observe({ type: 'longtask', buffered: false });
    for (const event of ['pointerdown', 'keydown']) {
      document.addEventListener(event, (input) => {
        if (!input.isTrusted) return;
        const start = input.timeStamp;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            samples.inputs.push({
              event,
              milliseconds: performance.now() - start,
            });
          })
        );
      });
    }
  });
}

export async function settleHeartsFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

export async function readHeartsMetrics(page: Page) {
  await settleHeartsFrames(page);
  return await page.evaluate(
    () => (window as unknown as MeasuredWindow).heartsSamples
  );
}

export async function saveHeartsMetrics(
  page: Page,
  info: TestInfo,
  rate: number
) {
  const samples = await readHeartsMetrics(page);
  expect(samples.inputs.length).toBeGreaterThan(0);
  const sorted = samples.inputs
    .map((sample) => sample.milliseconds)
    .sort((a, b) => a - b);
  await attachHeartsText(
    info,
    'input-render-metrics.json',
    JSON.stringify(
      {
        measurement:
          'Trusted input timestamp to second animation frame; a render-latency proxy, not INP',
        cpuThrottle: rate,
        viewport: page.viewportSize(),
        browser: page.context().browser()?.version(),
        sampleCount: sorted.length,
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        maximum: sorted.at(-1),
        ...samples,
        limits:
          'One deterministic fixture run on hosted Chromium. CPU throttling approximates constrained hardware; no physical phone or native build is established.',
      },
      null,
      2
    )
  );
}
