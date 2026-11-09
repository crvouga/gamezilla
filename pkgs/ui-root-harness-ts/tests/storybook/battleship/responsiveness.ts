// @io-wall-ok — browser timing instrumentation at the automated test boundary.
import type { Page, TestInfo } from '@playwright/test';
import { finishTimingCapture, startTimingCapture } from './timing-capture';

/** Two animation frames after an input: paint-opportunity cadence. */
function twoFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now() - start))
        );
      })
  );
}

/** Timed clicks on `targets` in order, one sequence of the probe. */
async function probe(
  page: Page,
  kind: 'region' | 'aim',
  repetition: number,
  targets: readonly string[]
) {
  await startTimingCapture(page);
  const postActionTwoFrameMs: number[] = [];
  const inputs: { target: string; startedAt: number }[] = [];
  for (const target of targets) {
    inputs.push({
      target,
      startedAt: await page.evaluate(() => performance.now()),
    });
    await page.getByTestId(target).click();
    postActionTwoFrameMs.push(await twoFrames(page));
  }
  return {
    kind,
    repetition,
    inputs,
    browser: await finishTimingCapture(page),
    postActionTwoFrameMs,
  };
}

const REGION_CLICKS = Array.from(
  { length: 12 },
  (_, index) => `custom-game-board-area-${index % 10}`
);
/** Six cells of the last region, each aimed at and then cancelled. */
const AIM_CELLS = ['f9', 'g10', 'h9', 'i10', 'j9', 'j10'];
function aimClicks(prefix: 'aim' | 'target') {
  return AIM_CELLS.flatMap((cell) => [
    `custom-game-board-${prefix}-${cell}`,
    'custom-game-board-cancel-aim',
  ]);
}

/** Three repeated region sequences with interaction IDs and processing timestamps. */
export async function measureTargeting(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  try {
    const runs = [];
    // A phone or tablet switches regions, then aims in the last one; a wide
    // screen aims at the whole board.
    const workbench =
      (await page.getByTestId('custom-game-board-region').count()) > 0;
    if (workbench)
      for (let repetition = 0; repetition < 3; repetition += 1)
        runs.push(await probe(page, 'region', repetition, REGION_CLICKS));
    if (workbench) await page.getByTestId('custom-game-board-area-9').click();
    for (let repetition = 0; repetition < 3; repetition += 1)
      runs.push(
        await probe(
          page,
          'aim',
          repetition,
          aimClicks(workbench ? 'aim' : 'target')
        )
      );
    await info.attach('responsiveness', {
      body: JSON.stringify({
        cpuSlowdown: 6,
        repetitions: 3,
        samplesPerRepetition: 12,
        sequences:
          'region: 12 region switches (phone and tablet only); aim: 6 cells of F9–J10, each aimed at then cancelled (12 inputs), on every screen',
        runs,
        limits:
          'Three sequences of each kind in one browser context: first and repeated warm local interactions, not three independent devices or cold navigations. Synthetic CPU slowdown, not physical mobile hardware. Event Timing omits events below16ms and quantizes durations; interaction IDs distinguish overlapping events. Processing timestamps support delay/handler attribution, but duration remainder is approximate presentation time. Frame samples start after Playwright click resolves: paint-opportunity cadence, not input latency. No network/transport latency is measured. Storybook overhead removed before timing: highlight addon disabled before navigation (__STORYBOOK_HIGHLIGHT_INITIALIZED) and the preview keydown forwarding (window.onkeydown) cleared; the story runs with motion:system.',
      }),
      contentType: 'application/json',
    });
  } finally {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await session.detach();
  }
}
