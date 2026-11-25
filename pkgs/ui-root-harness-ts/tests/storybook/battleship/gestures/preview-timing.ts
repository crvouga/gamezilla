// @io-wall-ok — browser input-to-preview measurement in the hosted fixture.
import type { Locator, TestInfo } from '@playwright/test';

/** Measure the actual move into C2 through its visible, five-cell preview. */
export async function observePreview(grid: Locator) {
  await grid.evaluate((root) => {
    window.addEventListener(
      'pointermove',
      function moved(e) {
        if (!(e instanceof PointerEvent) || !e.buttons) return;
        const cell = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest('[data-cell]')
          ?.getAttribute('data-cell');
        if (cell !== 'c2') return;
        window.removeEventListener('pointermove', moved, true);
        performance.mark('carrier-move');
        const read = () => {
          if (
            root.querySelectorAll('[data-emphasis="preview"]').length !== 5 ||
            !root.querySelector('[data-cell="a2"][data-emphasis="preview"]')
          )
            return;
          observer.disconnect();
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              performance.mark('carrier-preview-frame')
            )
          );
        };
        const observer = new MutationObserver(read);
        observer.observe(root, {
          attributes: true,
          subtree: true,
          attributeFilter: ['data-emphasis'],
        });
        read();
      },
      true
    );
  });
}
export async function savePreviewTime(grid: Locator, info: TestInfo) {
  const page = grid.page();
  await page.waitForFunction(
    () => performance.getEntriesByName('carrier-preview-frame').length > 0
  );
  const duration = await page.evaluate(
    () =>
      performance.measure(
        'move-to-preview',
        'carrier-move',
        'carrier-preview-frame'
      ).duration
  );
  await info.attach('preview-timing', {
    body: JSON.stringify({
      durationMs: duration,
      from: 'pointermove entering C2',
      through: 'two frames after all five Carrier cells preview at A2–E2',
    }),
    contentType: 'application/json',
  });
}
