// @io-wall-ok — browser performance instrumentation, never product timing.
import { expect, type Page, type TestInfo } from '@playwright/test';

type Samples = {
  inputToFrameMs: number[];
  longTaskMs: number[];
};

/** One timed input and the move count it must reach. */
export type TimedStep = (page: Page, index: number) => Promise<number>;

/** Walk left and right with the keyboard from `startingMoves`. */
export function walking(startingMoves: number): TimedStep {
  return async (page, index) => {
    await page
      .getByTestId('sokoban-board')
      .press(index % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    return startingMoves + index + 1;
  };
}

/**
 * From a fresh board whose first move right pushes a crate: push with the
 * keyboard, then press Undo with the pointer, so pushes and the history
 * command are timed as well as walking.
 */
export const pushAndUndo: TimedStep = async (page, index) => {
  if (index % 2 === 0) {
    await page.getByTestId('sokoban-board').press('ArrowRight');
    return 1;
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  return 0;
};

/** How a timing run moves: walking from a move count, or its own steps. */
export type TimingPlan =
  | number
  | { readonly step: TimedStep; readonly name: string };

export async function measureSokoban(
  page: Page,
  info: TestInfo,
  rate: number,
  plan: TimingPlan = 2
) {
  const step = typeof plan === 'number' ? walking(plan) : plan.step;
  const name = typeof plan === 'number' ? 'responsiveness' : plan.name;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  try {
    await page.evaluate(() => {
      // The preview forwards every keydown to Storybook's manager; that is
      // harness work, not the game's, so it is off while moves are timed.
      window.onkeydown = null;
      const samples: Samples = { inputToFrameMs: [], longTaskMs: [] };
      const scope = window as unknown as { sokobanSamples: Samples };
      scope.sokobanSamples = samples;
      let inputAt: number | undefined;
      const mark = () => {
        inputAt = performance.now();
      };
      // A key or a pointer press starts the clock.
      document.addEventListener('keydown', mark, { capture: true });
      document.addEventListener('pointerdown', mark, { capture: true });
      const counts = document.querySelector('[data-testid="sokoban-counts"]');
      if (!counts) throw new Error('Missing move count');
      new MutationObserver(() => {
        if (inputAt === undefined) return;
        const start = inputAt;
        inputAt = undefined;
        requestAnimationFrame(() => {
          samples.inputToFrameMs.push(performance.now() - start);
        });
      }).observe(counts, { attributes: true, attributeFilter: ['data-moves'] });
      new PerformanceObserver((list) => {
        samples.longTaskMs.push(
          ...list.getEntries().map((entry) => entry.duration)
        );
      }).observe({ type: 'longtask', buffered: false });
    });
    const board = page.getByTestId('sokoban-board');
    await board.focus();
    for (let i = 0; i < 20; i += 1) {
      const moves = await step(page, i);
      await expect(page.getByTestId('sokoban-counts')).toHaveAttribute(
        'data-moves',
        String(moves)
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          })
      );
    }
    const samples = await page.evaluate(
      () => (window as unknown as { sokobanSamples: Samples }).sokobanSamples
    );
    expect(samples.inputToFrameMs).toHaveLength(20);
    const sorted = [...samples.inputToFrameMs].sort((a, b) => a - b);
    const report = {
      name,
      cpuSlowdown: rate,
      viewport: page.viewportSize(),
      samples,
      medianMs: sorted[9],
      p95Ms: sorted[18],
      maxMs: sorted[19],
      harness:
        'Storybook highlight addon disabled before navigation; preview keydown forwarding to the manager removed while timing.',
      limits:
        'Chromium emulation on a hosted runner; key or pointer press to next animation frame after move-count DOM update. Not physical display latency, network saving latency or a physical low-end device benchmark. Reduced motion follows the canonical harness.',
    };
    await info.attach(`${name}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    // One line per condition in the job log, so the measurement is readable
    // from the hosted run itself.
    process.stdout.write(
      `SOKOBAN_TIMING ${JSON.stringify({
        test: info.title,
        name,
        viewport: report.viewport,
        cpuSlowdown: rate,
        medianMs: report.medianMs,
        p95Ms: report.p95Ms,
        maxMs: report.maxMs,
        longTasks: samples.longTaskMs.length,
        inputToFrameMs: samples.inputToFrameMs,
      })}\n`
    );
    // Budgets: a move reaches the screen within two frames (one at most for
    // most moves) at full speed, within three at 4x CPU slowdown, and no
    // long task blocks input while moving.
    const frames = rate === 1 ? 2 : 3;
    expect(report.p95Ms ?? Infinity).toBeLessThanOrEqual(frames * 16.7);
    expect(samples.longTaskMs).toEqual([]);
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
}
