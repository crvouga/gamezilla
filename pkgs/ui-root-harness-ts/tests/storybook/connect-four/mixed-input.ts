import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

/** Retain the same focus/hover sequence before and after the input fixes. */
export async function captureMixedInput(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openBoard(page, 'drop-a-disc', theme);
  const focused = page.getByTestId('custom-game-board-column-2');
  const hovered = page.getByTestId('custom-game-board-column-6');
  const board = page.getByTestId('custom-game-board');
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
  await expect(page.getByTestId('custom-game-board-cell-1')).toHaveAttribute(
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
