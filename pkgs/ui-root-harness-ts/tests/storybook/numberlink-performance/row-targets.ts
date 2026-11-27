import type { Page } from '@playwright/test';

/** Sample both endpoints before pickup, including what a native press will hit. */
export function rowTargets(page: Page, row: number) {
  return page.getByTestId('numberlink-board').evaluate((board, y) => {
    function bounds(element: Element | null) {
      if (!element) return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }
    const target = (index: number) => {
      const cell = board.querySelector(`[data-cell="${index}"]`);
      if (!cell) throw new Error(`Missing Numberlink cell ${index}`);
      const rect = cell.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        cell: index,
        hit:
          hit?.closest('[data-testid]')?.getAttribute('data-testid') ??
          hit?.tagName,
      };
    };
    return {
      start: target(y * 20),
      end: target(y * 20 + 19),
      board: bounds(board),
      room: bounds(board.closest('[data-game-board]')),
      progress: document.querySelector('[data-testid="numberlink-progress"]')
        ?.textContent,
      feedback: document.querySelector(
        '[data-testid="numberlink-drawing-status"]'
      )?.textContent,
    };
  }, row);
}
