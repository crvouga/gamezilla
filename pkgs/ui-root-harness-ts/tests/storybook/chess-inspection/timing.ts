// @io-wall-ok — hosted browser input timestamps and frame delivery.
import type { Page, TestInfo } from '@playwright/test';

export async function recordNavigation(page: Page, info: TestInfo) {
  const durations = await page.evaluateHandle(() => {
    const samples: number[] = [];
    const sample = (event: Event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('[data-chess-inspection]')
      )
        return;
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => samples.push(performance.now() - start))
      );
    };
    window.addEventListener('pointermove', sample, true);
    window.addEventListener('wheel', sample, true);
    return samples;
  });
  return async () => {
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        )
    );
    const samples = await durations.jsonValue();
    if (!samples.length)
      throw new Error('No board movement reached the frame sampler');
    await info.attach('navigation-two-frame-ms', {
      body: JSON.stringify(samples),
      contentType: 'application/json',
    });
    await durations.dispose();
  };
}
