// @io-wall-ok — browser performance instrumentation, never product timing.
import { expect, type Page, type TestInfo } from '@playwright/test';

type Samples = {
  inputToFrameMs: number[];
  longTaskMs: number[];
};

export async function measureSokoban(
  page: Page,
  info: TestInfo,
  rate: number,
  startingMoves = 2
) {
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
      document.addEventListener(
        'keydown',
        () => {
          inputAt = performance.now();
        },
        { capture: true }
      );
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
      await board.press(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
      await expect(page.getByTestId('sokoban-counts')).toHaveAttribute(
        'data-moves',
        String(startingMoves + i + 1)
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
      cpuSlowdown: rate,
      viewport: page.viewportSize(),
      samples,
      medianMs: sorted[9],
      p95Ms: sorted[18],
      maxMs: sorted[19],
      harness:
        'Storybook highlight addon disabled before navigation; preview keydown forwarding to the manager removed while timing.',
      limits:
        'Chromium emulation on a hosted runner; key event to next animation frame after move-count DOM update. Not physical display latency, network saving latency or a physical low-end device benchmark. Reduced motion follows the canonical harness.',
    };
    await info.attach('responsiveness.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
}
