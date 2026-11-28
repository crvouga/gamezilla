import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

/** Retain the same focus/hover sequence before and after the input fixes. */
export async function captureMixedInput(page: Page, info: TestInfo) {
  await openBoard(page, 'drop-a-disc');
  const focused = page.getByTestId('game-session-board-column-2');
  const hovered = page.getByTestId('game-session-board-column-6');
  const board = page.getByTestId('game-session-board');
  await focused.focus();
  await hovered.hover();
  await page.mouse.move(0, 0);
  await expect(focused).toBeFocused();
  const afterPointerExit = await board.getAttribute('data-preview-cell');
  await captureBoard(page, info, 'keyboard-after-pointer-exit');
  await hovered.hover();
  const before = JSON.parse(
    (await board.getAttribute('data-cells')) ?? '[]'
  ) as number[];
  await focused.press('Enter');
  await expect(page.getByTestId('game-session-board-cell-1')).toHaveAttribute(
    'data-disc',
    '1'
  );
  const after = JSON.parse(
    (await board.getAttribute('data-cells')) ?? '[]'
  ) as number[];
  expect(after.filter((disc, index) => disc !== before[index])).toHaveLength(1);
  await captureBoard(page, info, 'keyboard-drop-under-hover');
  await info.attach('mixed-input-observations', {
    body: JSON.stringify(
      {
        focusedColumn: 2,
        hoveredColumn: 6,
        afterPointerExit,
        afterKeyboardDrop: await board.getAttribute('data-preview-cell'),
      },
      null,
      2
    ),
    contentType: 'application/json',
  });
}
