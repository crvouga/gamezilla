// @io-wall-ok — wall timings are measured only in this browser evidence adapter.
import { expect, type Page, type TestInfo } from '@playwright/test';

type Samples = { frames: number[]; inputs: number[]; longTasks: number[] };
type MetricsWindow = Window & { pongMetrics?: () => Samples };

/** Frame and long-task observations plus event-to-two-animation-frames proxy. */
export async function startPongMetrics(page: Page) {
  await page.evaluate(() => {
    const samples: Samples = { frames: [], inputs: [], longTasks: [] };
    let running = true;
    let previous = performance.now();
    const frame = (time: number) => {
      if (!running) return;
      samples.frames.push(time - previous);
      previous = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const input = () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          samples.inputs.push(performance.now() - start);
        })
      );
    };
    const court = document.querySelector('[data-component="PaddleCourt"]');
    if (!court) throw new Error('Missing Pong court');
    court.addEventListener('keydown', input);
    court.addEventListener('pointermove', input);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        samples.longTasks.push(entry.duration);
    });
    observer.observe({ entryTypes: ['longtask'] });
    (window as MetricsWindow).pongMetrics = () => {
      running = false;
      observer.disconnect();
      court.removeEventListener('keydown', input);
      court.removeEventListener('pointermove', input);
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
  await info.attach('pong-responsiveness', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        cpuRate,
        viewport: page.viewportSize(),
        browser: page.context().browser()?.version(),
        samples,
        limits:
          'Hosted Chromium component fixture. Two-animation-frame proxy excludes hardware touch latency, display scanout, continuous production simulation and network latency. CPU throttling is not a physical low-end device.',
      },
      null,
      2
    ),
  });
}
