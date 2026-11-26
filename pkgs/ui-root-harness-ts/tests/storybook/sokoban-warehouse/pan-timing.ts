// @io-wall-ok — hosted browser input timing.
import { expect, type Locator, type TestInfo } from '@playwright/test';

type PanSample = { elapsed: number; changed: boolean };

/** One real input at a time. The frame counts only if the camera has moved. */
export async function measurePan(
  board: Locator,
  info: TestInfo,
  eventName: 'pointermove' | 'wheel',
  input: (index: number) => Promise<unknown>
) {
  const samples: PanSample[] = [];
  for (let index = 0; index < 20; index++) {
    const ready = board.evaluateHandle((element, name) => {
      const sample = new Promise<PanSample>((resolve) => {
        element.addEventListener(
          name,
          (event) => {
            const before = element.style.getPropertyValue('--warehouse-camera');
            requestAnimationFrame(() =>
              resolve({
                elapsed: performance.now() - event.timeStamp,
                changed:
                  element.style.getPropertyValue('--warehouse-camera') !==
                  before,
              })
            );
          },
          { once: true, capture: true }
        );
      });
      return { sample };
    }, eventName);
    const probe = await ready;
    try {
      await input(index);
      samples.push(await probe.evaluate((value) => value.sample));
    } finally {
      await probe.dispose();
    }
  }
  expect(samples.every((sample) => sample.changed)).toBe(true);
  const sorted = samples.map((sample) => sample.elapsed).sort((a, b) => a - b);
  await info.attach('pan-timing.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      eventName,
      samples,
      p95Ms: sorted[18],
      scope:
        'Input timestamp to next animation-frame callback with changed camera transform; hosted Chromium, normal CPU.',
    }),
  });
}
