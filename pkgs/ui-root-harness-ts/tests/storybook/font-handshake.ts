import type { Page } from '@playwright/test';

/** Observe a loader request or old-code play completion without a timing guess. */
export async function fontHandshake(
  page: Page
): Promise<{ boundary: Promise<string> }> {
  const boundary = Promise.withResolvers<string>();
  await page.exposeFunction('fontBoundary', boundary.resolve);
  await page.addInitScript(() => {
    const notify = (kind: string): void => {
      void (
        window as unknown as { fontBoundary: (value: string) => Promise<void> }
      ).fontBoundary(kind);
    };
    document.addEventListener(
      'focus',
      () => {
        const root = document.documentElement;
        root.dataset['fontTestFocus'] = String(
          Number(root.dataset['fontTestFocus'] ?? 0) + 1
        );
      },
      true
    );
    const load = document.fonts.load.bind(document.fonts);
    document.fonts.load = (...args) => {
      const pending = load(...args);
      notify('font-load');
      return pending;
    };
    const observer = new MutationObserver(() => {
      if (
        document
          .querySelector('#storybook-root')
          ?.getAttribute('data-story-ready') === 'true'
      ) {
        notify('play-finished');
        observer.disconnect();
      }
    });
    observer.observe(document, {
      subtree: true,
      attributes: true,
      childList: true,
    });
  });
  // Wrap the promise so setup does not await the future browser boundary.
  return { boundary: boundary.promise };
}

export async function fontViewport(page: Page) {
  return await page.evaluate(() => ({
    active:
      document.activeElement?.getAttribute('aria-label') ??
      document.activeElement?.textContent,
    text: document.querySelector('#storybook-root')?.textContent,
    scroll: [...document.querySelectorAll<HTMLElement>('#storybook-root *')]
      .filter(
        (element) =>
          element.scrollHeight > element.clientHeight ||
          element.scrollWidth > element.clientWidth
      )
      .map((element) => ({
        component: element.getAttribute('data-component'),
        x: element.scrollLeft,
        y: element.scrollTop,
        width: element.clientWidth,
        height: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
      })),
  }));
}
