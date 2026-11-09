import { expect, type Page, type TestInfo } from '@playwright/test';

/** Report actual clipping, including the nested game scroller and outer host. */
async function clippedFinalCells(page: Page): Promise<string[]> {
  return page.getByTestId('custom-game-board').evaluate((board) => {
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
  await info.attach(name, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
}

/** Arrow keys expose the whole final row and winning line without shrinking the board. */
export async function expectFinalBoardReachable(page: Page, info: TestInfo) {
  const scroller = page.locator('[data-screen="custom-game"]');
  const board = page.getByTestId('custom-game-board');
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
  expect(
    await board.evaluate((element) => element.getBoundingClientRect().width)
  ).toBeGreaterThan(600);
  await expect(board.locator('[data-cell]')).toHaveCount(42);
  await capture(page, info, 'final-board-before-scroll');
  await scroller.focus();
  for (
    let step = 0;
    step < 24 && (await clippedFinalCells(page)).length > 0;
    step += 1
  ) {
    const before = await scroller.evaluate((element) => element.scrollTop);
    await scroller.press('ArrowDown');
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(before);
  }
  await expect.poll(() => clippedFinalCells(page)).toEqual([]);
  await capture(page, info, 'final-board-after-keyboard-scroll');
  await scroller.press('Home');
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page.getByTestId('custom-game-rematch')).toBeInViewport({
    ratio: 1,
  });
}
