import { expect, type Page } from '@playwright/test';

type Measurements = {
  inputToPaintMs: number[];
  frameMs: number[];
  longTasksMs: number[];
};

type MeasuredWindow = Window & {
  lightCyclesMeasurements: Measurements;
  stopLightCyclesMeasurements: () => void;
};

/** Browser instrumentation only. Two animation frames bound a paint opportunity. */
export async function startMeasurements(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as MeasuredWindow;
    const measurements: Measurements = {
      inputToPaintMs: [],
      frameMs: [],
      longTasksMs: [],
    };
    target.lightCyclesMeasurements = measurements;
    let previous = performance.now();
    let frame = 0;
    const sample = (now: number) => {
      measurements.frameMs.push(now - previous);
      previous = now;
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        measurements.longTasksMs.push(entry.duration);
    });
    observer.observe({ type: 'longtask', buffered: false });
    const arena = document.querySelector('[data-component="TrailArena"]');
    if (!arena) throw new Error('Arena missing from measurement');
    const input = () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          measurements.inputToPaintMs.push(performance.now() - start)
        )
      );
    };
    arena.addEventListener('keydown', input, { capture: true });
    target.stopLightCyclesMeasurements = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      arena.removeEventListener('keydown', input, { capture: true });
    };
  });
}

/** Trusted key events advance the existing deterministic production-step fixture. */
async function measureSteeringTrial(page: Page) {
  await page.getByTestId('custom-game-board-arena').focus();
  await startMeasurements(page);
  const rider = page.getByTestId('custom-game-board-arena-rider-0');
  for (const heading of ['right', 'down', 'right'] as const) {
    for (let index = 0; index < 2; index++) {
      const coordinate = heading === 'right' ? 'data-x' : 'data-y';
      const previous = Number(await rider.getAttribute(coordinate));
      await page.keyboard.press(
        heading === 'right' ? 'ArrowRight' : 'ArrowDown'
      );
      await expect(rider).toHaveAttribute(coordinate, String(previous + 1));
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
    }
  }
  return finishMeasurements(page);
}

/** Keep every measured input inside active play, including Quad's earlier round end. */
export async function measureSteering(page: Page, cpuRate = 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const first = await measureSteeringTrial(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.reload();
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const second = await measureSteeringTrial(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return {
    inputToPaintMs: [...first.inputToPaintMs, ...second.inputToPaintMs],
    frameMs: [...first.frameMs, ...second.frameMs],
    longTasksMs: [...first.longTasksMs, ...second.longTasksMs],
  };
}

export async function finishMeasurements(page: Page) {
  return page.evaluate(() => {
    const target = window as unknown as MeasuredWindow;
    target.stopLightCyclesMeasurements();
    return target.lightCyclesMeasurements;
  });
}
