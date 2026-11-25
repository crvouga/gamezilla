// @io-wall-ok — measure trusted pointer motion in the hosted browser.
import type { Page } from '@playwright/test';

export async function observeDragFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: number[] = [];
    Object.assign(window, { quoridorDragFrames: samples });
    document.addEventListener(
      'pointermove',
      (event) => {
        if (!event.isTrusted || !event.buttons) return;
        const start = performance.now();
        requestAnimationFrame(() => samples.push(performance.now() - start));
      },
      true
    );
  });
}

export async function gestureMetrics(page: Page) {
  return page.evaluate(() => {
    const samples: unknown = Reflect.get(window, 'quoridorMetrics');
    const moveToFrameMs: unknown = Reflect.get(window, 'quoridorDragFrames');
    return { samples, moveToFrameMs };
  });
}
