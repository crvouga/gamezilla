import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

/** Report actual clipping, including the nested game scroller and outer host. */
async function clippedFinalCells(page: Page): Promise<string[]> {
  return page.getByTestId('game-session-board').evaluate((board) => {
    const cells = board.querySelectorAll<HTMLElement>(
      '[data-cell="0"], [data-cell="1"], [data-cell="2"], [data-cell="3"], [data-cell="4"], [data-cell="5"], [data-cell="6"], [data-winning="true"]'
    );
    return Array.from(cells).flatMap((cell) => {
      let left = 0;
      let top = 0;
      let right = window.innerWidth;
      let bottom = window.innerHeight;
      for (
        let parent = cell.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (style.overflowX !== 'visible') {
          left = Math.max(left, bounds.left + parent.clientLeft);
          right = Math.min(
            right,
            bounds.left + parent.clientLeft + parent.clientWidth
          );
        }
        if (style.overflowY !== 'visible') {
          top = Math.max(top, bounds.top + parent.clientTop);
          bottom = Math.min(
            bottom,
            bounds.top + parent.clientTop + parent.clientHeight
          );
        }
      }
      const box = cell.getBoundingClientRect();
      return box.width > 0 &&
        box.height > 0 &&
        box.left >= left - 1 &&
        box.right <= right + 1 &&
        box.top >= top - 1 &&
        box.bottom <= bottom + 1
        ? []
        : [cell.getAttribute('data-testid') ?? 'missing cell identifier'];
    });
  });
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

/**
 * The whole final board and its winning line show in the first view, and
 * stay shown while the keyboard scrolls the screen to its end and back:
 * the stage holds the board in place instead of letting it scroll away.
 */
export async function expectFinalBoardReachable(page: Page, info: TestInfo) {
  // The result place of the game session (`game-session-result`).
  const scroller = page.locator('[data-screen^="game-session"]');
  const board = page.getByTestId('game-session-board');
  await expect(scroller).toHaveCount(1);
  expect(await scroller.evaluate((element) => element.scrollTop)).toBe(0);
  expect(
    await scroller.evaluate((element) => getComputedStyle(element).overflowY)
  ).toBe('auto');
  expect(
    await scroller.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await expect(board.locator('[data-cell]')).toHaveCount(42);
  await expect.poll(() => clippedFinalCells(page)).toEqual([]);
  await capture(page, info, 'final-board-first-view');
  await scroller.focus();
  await scroller.press('End');
  await expect
    .poll(() =>
      scroller.evaluate(
        (element) =>
          element.scrollHeight - element.clientHeight - element.scrollTop
      )
    )
    .toBeLessThanOrEqual(1);
  await expect.poll(() => clippedFinalCells(page)).toEqual([]);
  await capture(page, info, 'final-board-after-keyboard-scroll');
  await scroller.press('Home');
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page.getByTestId('game-session-rematch')).toBeInViewport({
    ratio: 1,
  });
}

/** Preserve the actual board, its fit and its available room on a geometry failure. */
export async function expectActionBelowBoard(action: Locator, board: Locator) {
  const actionBox = await action.boundingBox();
  const boardBox = await board.boundingBox();
  if (!actionBox || !boardBox) throw new Error('Missing board or action');
  const bottom = boardBox.y + boardBox.height;
  if (actionBox.y >= bottom) return;
  const geometry = await board.evaluate((rack) => {
    const rows = [];
    for (let node: Element | null = rack; node; node = node.parentElement) {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      rows.push({
        role: node.getAttribute('data-component') ?? node.className,
        y: box.y,
        width: box.width,
        height: box.height,
        room: style.getPropertyValue('--game-board-room'),
        fitted: style.getPropertyValue('--game-stage-room'),
      });
      if (node.hasAttribute('data-game-fixed')) break;
    }
    return rows;
  });
  expect(actionBox.y, JSON.stringify(geometry)).toBeGreaterThanOrEqual(bottom);
}
