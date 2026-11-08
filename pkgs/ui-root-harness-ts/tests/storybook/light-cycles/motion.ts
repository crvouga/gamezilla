import { expect, type Page, type TestInfo } from '@playwright/test';
import { finishMeasurements, startMeasurements } from './measure';

/** Eight virtual seconds of production states, paced at two display frames per tick. */
export async function measureMotion(
  page: Page,
  info: TestInfo,
  cpuRate: number
) {
  await startMeasurements(page);
  const motion = await page.evaluate(async () => {
    const root = document.querySelector('#storybook-root');
    if (!root) throw new Error('Missing story root');
    const samples: {
      updateMs: number;
      paintOpportunityMs: number;
      occupied: number;
      heads: string;
    }[] = [];
    for (let tick = 0; tick < 240; tick++) {
      const start = performance.now();
      root.dispatchEvent(
        new CustomEvent('advance-story-time', { detail: 1000 / 30 })
      );
      const updateMs = performance.now() - start;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const heads = [...root.querySelectorAll('[data-heading][data-x]')]
        .map(
          (head) =>
            `${head.getAttribute('data-x')},${head.getAttribute('data-y')}`
        )
        .join('|');
      const occupied = [
        ...root.querySelectorAll('path[data-trail-count]'),
      ].reduce(
        (sum, path) => sum + Number(path.getAttribute('data-trail-count')),
        0
      );
      samples.push({
        updateMs,
        paintOpportunityMs: performance.now() - start,
        occupied,
        heads,
      });
    }
    return samples;
  });
  const frame = await finishMeasurements(page);
  await info.attach('sustained-motion.json', {
    body: JSON.stringify(
      {
        test: info.title,
        viewport: page.viewportSize(),
        cpuRate,
        samples: motion,
        frame,
        limits:
          '240 precomputed production simulation states after 450 warm-up ticks. Bot search and fixture loading occur before the measured rendering window; no network or physical device claim. The driver paces virtual ticks with two animation frames, and measures dispatch-to-DOM work and second-frame paint opportunities. This is not photon latency or an unthrottled real-time soak.',
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
  expect(new Set(motion.map((sample) => sample.heads)).size).toBeGreaterThan(
    10
  );
  expect(Math.max(...motion.map((sample) => sample.occupied))).toBeGreaterThan(
    100
  );
}
