// @io-wall-ok — read-only evidence from the automated browser fixture.
import type { Page } from '@playwright/test';

/** Bounded context for unresolved axe contrast checks; this does not clear them. */
export async function contrastDiagnostic(page: Page, selectors: string[]) {
  return page.evaluate((targets) => {
    const describe = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        component: element.getAttribute('data-component'),
        text: element.textContent.trim().slice(0, 100),
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        style: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
          overflow: style.overflow,
          display: style.display,
          visibility: style.visibility,
        },
      };
    };
    return targets.slice(0, 12).map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, matched: false };
      const bounds = element.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(innerWidth - 1, bounds.x + bounds.width / 2)
      );
      const y = Math.max(
        0,
        Math.min(innerHeight - 1, bounds.y + bounds.height / 2)
      );
      return {
        selector,
        matched: true,
        element: describe(element),
        hitPoint: { x, y },
        hitStack: document.elementsFromPoint(x, y).slice(0, 6).map(describe),
      };
    });
  }, selectors);
}
