// @io-wall-ok — browser geometry evidence, including failed opening stories.
import type { Page, TestInfo } from '@playwright/test';
import { retainEvidence } from './retained-evidence';

export async function recordGeometry(
  page: Page,
  info: TestInfo
): Promise<void> {
  const geometry = await page.evaluate(() => {
    const box = (rect: DOMRect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    const selectors = [
      '[data-testid="custom-game-seat-near"]',
      '[data-testid="custom-game-board-rack"]',
      '[data-testid="custom-game-board-submit"]',
      '[data-testid="custom-game-board-more"]',
      '[aria-label="Scrollable word board"]',
    ];
    const elements = selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true };
      const rect = element.getBoundingClientRect();
      const ancestors = [];
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const css = getComputedStyle(parent);
        if (css.overflowX === 'visible' && css.overflowY === 'visible')
          continue;
        ancestors.push({
          component: parent.dataset['component'] ?? parent.tagName,
          rect: box(parent.getBoundingClientRect()),
          overflowX: css.overflowX,
          overflowY: css.overflowY,
          scrollHeight: parent.scrollHeight,
          clientHeight: parent.clientHeight,
        });
      }
      const hit = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2
      );
      return {
        selector,
        rect: box(rect),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        centerUncovered: hit !== null && element.contains(hit),
        ancestors,
      };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      scroll: { x: scrollX, y: scrollY },
      elements,
    };
  });
  await retainEvidence(info, 'geometry.json', {
    body: JSON.stringify(geometry, null, 2),
    contentType: 'application/json',
  });
}
