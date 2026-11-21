// @io-wall-ok — browser performance instrumentation, never product timing.
import { expect, type Page, type TestInfo } from '@playwright/test';
import {
  prepareSokobanMoves,
  runSokobanMoves,
  type TimedStep,
  walking,
} from '../../../storybook/sokoban-timed-input';
import {
  type Samples,
  withSokobanTiming,
} from '../../../storybook/sokoban-timing-probe';

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
  const moves = await prepareSokobanMoves(page);
  await page.getByTestId('sokoban-board').focus();
  const cdp = await page.context().newCDPSession(page);
  // Garbage left by the steps before timing (captures, video and trace) is
  // not a move's: collected now, it cannot land as a long task on the first
  // timed moves (a lone ~90 ms task on the hosted runner, runs 43126884057).
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  try {
    await withSokobanTiming(page, async () => {
      await runSokobanMoves(page, step, moves.readAfterFrame);
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
          timeOrigin: samples.timeOrigin,
          inputs: samples.inputs,
          frames: samples.frames,
          longTaskEntries: samples.longTasks,
          workerIndex: info.workerIndex,
          parallelIndex: info.parallelIndex,
        })}\n`
      );
      // Budgets: a move reaches the screen within two frames (one at most for
      // most moves) at full speed, within three at 4x CPU slowdown, and no
      // long task blocks input while moving.
      const frames = rate === 1 ? 2 : 3;
      expect(report.p95Ms ?? Infinity).toBeLessThanOrEqual(frames * 16.7);
      expect(samples.longTaskMs).toEqual([]);
    });
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    await moves.dispose();
  }
}
