// @io-wall-ok — browser timing instrumentation at the automated test boundary.
import type { Page, TestInfo } from '@playwright/test';
import { finishTimingCapture, startTimingCapture } from './timing-capture';

async function regionProbe(page: Page, repetition: number) {
  await startTimingCapture(page);
  const postActionTwoFrameMs: number[] = [];
  const inputs: { region: number; startedAt: number }[] = [];
  for (let index = 0; index < 12; index += 1) {
    const region = index % 10;
    inputs.push({
      region,
      startedAt: await page.evaluate(() => performance.now()),
    });
    await page.getByTestId(`custom-game-board-area-${region}`).click();
    postActionTwoFrameMs.push(
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
  return {
    repetition,
    inputs,
    browser: await finishTimingCapture(page),
    postActionTwoFrameMs,
  };
}

/** Three repeated region sequences with interaction IDs and processing timestamps. */
export async function measureTargeting(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  try {
    const runs = [];
    for (let repetition = 0; repetition < 3; repetition += 1)
      runs.push(await regionProbe(page, repetition));
    await info.attach('responsiveness', {
      body: JSON.stringify({
        cpuSlowdown: 6,
        repetitions: 3,
        samplesPerRepetition: 12,
        runs,
        limits:
          'Three sequences in one browser context: first and repeated warm local interactions, not three independent devices or cold navigations. Synthetic CPU slowdown, not physical mobile hardware. Event Timing omits events below16ms and quantizes durations; interaction IDs distinguish overlapping events. Processing timestamps support delay/handler attribution, but duration remainder is approximate presentation time. Frame samples start after Playwright click resolves: paint-opportunity cadence, not input latency. No network/transport latency is measured.',
      }),
      contentType: 'application/json',
    });
  } finally {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await session.detach();
  }
}
