import { expect, within } from 'storybook/test';

/** Geometry is checked before any userEvent can scroll an element into view. */
export async function expectBoardFirst(
  canvasElement: HTMLElement,
  terminal = false
) {
  const canvas = within(canvasElement);
  const board = await canvas.findByTestId('custom-game-board');
  const view = canvasElement.ownerDocument.defaultView;
  if (!view) throw new Error('The board needs a browser viewport');
  await expect(view.scrollY).toBe(0);
  let parent: HTMLElement | null = board.parentElement;
  while (parent) {
    await expect(parent.scrollTop).toBe(0);
    parent = parent.parentElement;
  }
  const box = board.getBoundingClientRect();
  // In the stage a board is as wide as the window's height lets the space's
  // rows and the action bar around it stay in view (never under 320px).
  await expect(box.width).toBeGreaterThan(
    view.innerWidth < 880 ? 320 : Math.max(319, view.innerHeight - 384)
  );
  await expect(box.left).toBeGreaterThanOrEqual(0);
  await expect(box.right).toBeLessThanOrEqual(view.innerWidth);
  await expect(box.top).toBeLessThan(
    terminal ? 440 : view.innerWidth < 880 ? 320 : 260
  );
  return { canvas, view, board };
}

export async function expectTerminalVisible(canvasElement: HTMLElement) {
  const { canvas, view, board } = await expectBoardFirst(canvasElement, true);
  const headline = canvas.getByTestId('custom-game-status');
  const rematch = canvas.getByTestId('custom-game-rematch');
  await expect(headline.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  await expect(rematch.getBoundingClientRect().bottom).toBeLessThan(
    view.innerHeight
  );
  // The outcome is the stage's status line over the board; the next action
  // is in the action bar under it, in the first view, never on the board.
  const action = rematch.getBoundingClientRect();
  const square = board.getBoundingClientRect();
  await expect(
    action.bottom <= square.top ||
      action.top >= square.bottom ||
      action.right <= square.left ||
      action.left >= square.right
  ).toBe(true);
  await expect(canvas.getAllByTestId('custom-game-rematch')).toHaveLength(1);
  await expect(canvas.getAllByTestId('custom-game-commands')).toHaveLength(1);
}
