import type { Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

/**
 * Why axe could not decide contrast: for the first nodes it left
 * incomplete, what lies at each node's centre, top first (six deep), so a
 * covering layer can be named instead of guessed. Diagnostic only.
 */
export async function contrastStacks(page: Page, results: AxeResults) {
  const targets = results.incomplete
    .filter((item) => item.id === 'color-contrast')
    .flatMap((item) => item.nodes)
    .map((node) => node.target[0])
    .filter((target): target is string => typeof target === 'string')
    .slice(0, 20);
  return page.evaluate((selectors) => {
    const describe = (element: Element) => {
      const component = element.getAttribute('data-component');
      const testId = element.getAttribute('data-testid');
      const style = getComputedStyle(element);
      return [
        element.tagName.toLowerCase(),
        component ? `[${component}]` : '',
        testId ? `#${testId}` : '',
        style.position === 'static' ? '' : ` ${style.position}`,
        style.backgroundImage === 'none' ? '' : ' bg-image',
        style.opacity === '1' ? '' : ` opacity:${style.opacity}`,
      ].join('');
    };
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const box = element.getBoundingClientRect();
      const stack = document
        .elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        .slice(0, 6)
        .map(describe);
      return {
        selector: selector.slice(-80),
        node: describe(element),
        offscreen:
          box.bottom < 0 ||
          box.top > innerHeight ||
          box.right < 0 ||
          box.left > innerWidth,
        stack,
      };
    });
  }, targets);
}
