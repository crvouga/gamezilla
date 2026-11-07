// @io-wall-ok — browser timing instrumentation at the automated test boundary.
import type { Page, TestInfo } from '@playwright/test';

/** Browser Event Timing reports input duration; frame samples report paint cadence. */
export async function measureTargeting(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.evaluate(() => {
    const samples: { type: string; name: string; duration: number }[] = [];
    const observers = ['event', 'longtask'].map((type) => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          samples.push({ type, name: entry.name, duration: entry.duration });
      });
      const options: PerformanceObserverInit & { durationThreshold: number } = {
        type,
        buffered: false,
        durationThreshold: 16,
      };
      observer.observe(options);
      return observer;
    });
    Object.assign(window, { battleshipMetrics: { samples, observers } });
  });
  const frameSamples: number[] = [];
  for (let index = 0; index < 12; index += 1) {
    await page.getByTestId(`custom-game-board-area-${index % 10}`).click();
    frameSamples.push(
      await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const start = performance.now();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - start))
            );
          })
      )
    );
  }
  const browser = await page.evaluate(() => {
    const metrics = (
      window as unknown as {
        battleshipMetrics: {
          samples: { type: string; name: string; duration: number }[];
          observers: PerformanceObserver[];
        };
      }
    ).battleshipMetrics;
    for (const observer of metrics.observers) {
      for (const entry of observer.takeRecords())
        metrics.samples.push({
          type: entry.entryType,
          name: entry.name,
          duration: entry.duration,
        });
      observer.disconnect();
    }
    return metrics.samples;
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await session.detach();
  await info.attach('responsiveness', {
    body: JSON.stringify({
      cpuSlowdown: 6,
      samples: 12,
      browser,
      postActionTwoFrameMs: frameSamples,
      limits:
        'Synthetic CPU slowdown, not physical mobile hardware. Event Timing omits events below 16ms and quantizes durations. Frame samples start after Playwright click resolves: paint-opportunity cadence, not input latency. No network or transport latency is measured.',
    }),
    contentType: 'application/json',
  });
}
