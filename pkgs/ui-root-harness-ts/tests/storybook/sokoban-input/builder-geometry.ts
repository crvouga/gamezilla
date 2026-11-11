import type { Page, TestInfo } from '@playwright/test';

/** Record clipping separately from an overlapping control inside the scroll area. */
export async function builderGeometry(page: Page, info: TestInfo) {
  const geometry = await page.evaluate(() => {
    const rectangle = (rect: DOMRect) => ({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    });
    const scroller = document.querySelector<HTMLElement>(
      '[data-screen="puzzle-content-author-board"]'
    );
    if (!scroller) throw new Error('Builder is missing');
    scroller.scrollTop = scroller.scrollHeight;
    const bounds = rectangle(scroller.getBoundingClientRect());
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="content-author-stage"] :is(button, input)'
      )
    ).map((control) => {
      const rect = control.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        name:
          control.getAttribute('data-testid') ??
          control.getAttribute('aria-label') ??
          control.textContent,
        rect: rectangle(rect),
        topmost: hit !== null && control.contains(hit),
        hit: hit?.closest('[data-component]')?.getAttribute('data-component'),
        inScroller:
          y >= bounds.top &&
          y < bounds.bottom &&
          x >= bounds.left &&
          x < bounds.right,
      };
    });
    return {
      bounds,
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      controls,
    };
  });
  await info.attach('builder-geometry.json', {
    body: JSON.stringify(geometry, null, 2),
    contentType: 'application/json',
  });
  return geometry;
}
