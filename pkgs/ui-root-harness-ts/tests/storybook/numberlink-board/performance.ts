// @io-wall-ok — browser timing adapter; measurements never enter product code.
import type { Page, TestInfo } from '@playwright/test';

type Measurements = { inputToFrameMs: number[]; longTasksMs: number[] };

export async function startMeasurements(page: Page, cpuRate: number) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.evaluate(() => {
    const values: Measurements = { inputToFrameMs: [], longTasksMs: [] };
    Object.assign(window, { numberlinkMeasurements: values });
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        values.longTasksMs.push(entry.duration);
    });
    observer.observe({ type: 'longtask' });
    const board = document.querySelector('[data-testid="numberlink-board"]');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown'])
      board?.addEventListener(type, (event) => {
        const start = event.timeStamp;
        requestAnimationFrame(() => {
          values.inputToFrameMs.push(performance.now() - start);
        });
      });
  });
  return session;
}

export async function reportMeasurements(
  page: Page,
  info: TestInfo,
  cpuRate: number
) {
  const values = await page.evaluate(() => {
    const measured = window as unknown as {
      numberlinkMeasurements: Measurements;
    };
    return {
      ...measured.numberlinkMeasurements,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
    };
  });
  const ordered = [...values.inputToFrameMs].sort((a, b) => a - b);
  await info.attach('performance', {
    body: JSON.stringify({
      ...values,
      cpuRate,
      sampleCount: ordered.length,
      p50Ms: ordered[Math.floor(ordered.length * 0.5)],
      p95Ms: ordered[Math.floor(ordered.length * 0.95)],
      maxMs: ordered.at(-1),
      limitation:
        'Event timestamp to next animation frame; excludes paint completion and physical display latency. Desktop CPU throttling approximates CPU pressure, not a real mobile device. Input pacing is automated.',
    }),
    contentType: 'application/json',
  });
}
