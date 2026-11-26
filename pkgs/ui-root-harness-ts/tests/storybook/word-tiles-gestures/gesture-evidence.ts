// @io-wall-ok — record trusted board input before the next render opportunity.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { retainEvidence } from '../word-tiles/retained-evidence';

export async function measureGestures(page: Page) {
  await page.evaluate(() => {
    const samples: number[] = [];
    Object.assign(window, { wordGestureFrames: samples });
    let pending = false;
    const record = (e: Event) => {
      if (
        pending ||
        !e.isTrusted ||
        !(e.target instanceof Element) ||
        !e.target.closest('[data-rack-tile], [data-navigable="true"]')
      )
        return;
      pending = true;
      const t = performance.now();
      requestAnimationFrame(() => {
        samples.push(performance.now() - t);
        pending = false;
      });
    };
    document.addEventListener('pointermove', record, true);
    document.addEventListener('wheel', record, true);
  });
}
export async function saveGestures(page: Page, info: TestInfo) {
  const samples = await page.evaluate(
    () =>
      (window as unknown as { wordGestureFrames: number[] }).wordGestureFrames
  );
  expect(samples.length).toBeGreaterThan(0);
  await retainEvidence(info, 'gesture-to-frame.json', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
}
