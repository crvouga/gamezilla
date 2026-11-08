import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

const column = (page: Page, number: number) =>
  page.getByTestId(`custom-game-board-column-${number}`);

/** Anchor just before the board, then use native browser keyboard traversal. */
export async function captureKeyboard(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openBoard(page, 'drop-a-disc', theme);
  const board = page.getByTestId('custom-game-board');
  const initial = await board.getAttribute('data-cells');
  await column(page, 1).focus();
  await page.keyboard.press('Shift+Tab');
  expect(
    await board.evaluate((node) => node.contains(document.activeElement))
  ).toBe(false);
  await page.keyboard.press('Tab');
  await expect(column(page, 1)).toBeFocused();
  await captureBoard(page, info, 'keyboard-entry');
  for (const [key, number] of [
    ['End', 7],
    ['ArrowRight', 1],
    ['ArrowLeft', 7],
    ['Home', 1],
    ['ArrowRight', 2],
    ['ArrowLeft', 1],
  ] as const) {
    await page.keyboard.press(key);
    await expect(column(page, number)).toBeFocused();
    await expect(board).toHaveAttribute(
      'data-preview-cell',
      String(number - 1)
    );
    await expect(board).toHaveAttribute('data-cells', initial ?? '');
  }
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  expect(
    await board.evaluate((node) => node.contains(document.activeElement))
  ).toBe(false);
  await page.keyboard.press('Shift+Tab');
  await expect(column(page, 7)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('custom-game-board-cell-6')).toHaveAttribute(
    'data-disc',
    '1'
  );
  await page.keyboard.press('Space');
  await expect(page.getByTestId('custom-game-board-cell-13')).toHaveAttribute(
    'data-disc',
    '2'
  );
  await captureBoard(page, info, 'keyboard-two-drops');
  await openBoard(page, 'full-column', theme);
  await column(page, 1).focus();
  const full = await board.getAttribute('data-cells');
  await page.keyboard.press('Space');
  await expect(board).toHaveAttribute('data-cells', full ?? '');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('custom-game-board-cell-8')).toHaveAttribute(
    'data-disc',
    '2'
  );
  await captureBoard(page, info, 'keyboard-refusal-recovery');
}

export async function captureInactiveKeyboard(
  page: Page,
  info: TestInfo,
  theme: string
) {
  for (const state of [
    'watching',
    'waiting-for-opponent',
    'won',
    'lost',
    'full-board-draw',
  ]) {
    await openBoard(page, state, theme);
    const board = page.getByTestId('custom-game-board');
    const before = await board.getAttribute('data-cells');
    await column(page, 1).focus();
    await page.keyboard.press('End');
    await expect(column(page, 7)).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(board).toHaveAttribute('data-cells', before ?? '');
    await expect(board).toHaveAttribute('data-preview-cell', '-1');
    await captureBoard(page, info, `keyboard-${state}`);
  }
}
