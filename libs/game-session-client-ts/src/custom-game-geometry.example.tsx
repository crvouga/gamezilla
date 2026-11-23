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
  // Beside its rail a board is as wide as the window's height lets the
  // seats and the commands around it stay in view (never under 320px).
  await expect(box.width).toBeGreaterThan(
    view.innerWidth < 880 ? 320 : Math.max(319, view.innerHeight - 384)
  );
  await expect(box.left).toBeGreaterThanOrEqual(0);
  await expect(box.right).toBeLessThanOrEqual(view.innerWidth);
  await expect(box.top).toBeLessThan(
    terminal ? 440 : view.innerWidth < 880 ? 320 : 220
  );
  return { canvas, view, board };
}

export async function expectTerminalVisible(canvasElement: HTMLElement) {
  const { canvas, view, board } = await expectBoardFirst(canvasElement, true);
  const headline = canvas.getByTestId('custom-game-result-headline');
  const rematch = canvas.getByTestId('custom-game-rematch');
  await expect(headline.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  await expect(rematch.getBoundingClientRect().bottom).toBeLessThan(
    view.innerHeight
  );
  // Since #379 the result card may sit under the board; its next action
  // stays in the first view and never covers the board.
  const action = rematch.getBoundingClientRect();
  const square = board.getBoundingClientRect();
  await expect(
    action.bottom <= square.top ||
      action.top >= square.bottom ||
      action.right <= square.left ||
      action.left >= square.right
  ).toBe(true);
  await expect(canvas.getAllByTestId('custom-game-rematch')).toHaveLength(1);
  await expect(canvas.getAllByTestId('custom-game-history-stats')).toHaveLength(
    1
  );
}

/** Two phone columns retain complete identities and each seat's readable facts. */
export async function expectFourSeatRail(seats: HTMLElement[]) {
  const boxes = seats.map((seat) => seat.getBoundingClientRect());
  const [first, second, third, fourth] = boxes;
  if (!first || !second || !third || !fourth)
    throw new Error('Four seats are required');
  await expect(second.top).toBe(first.top);
  await expect(fourth.top).toBe(third.top);
  await expect(third.top).toBe(Math.max(first.bottom, second.bottom) + 4);
  await expect(second.left).toBe(first.right + 4);
  await expect(fourth.left).toBe(third.right + 4);
  for (const seat of seats) {
    await expect(seat.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
    const labels = seat.querySelectorAll(
      '.textLabel, [data-component="GameSeatStat"]'
    );
    await expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const range = label.ownerDocument.createRange();
      range.selectNodeContents(label);
      const lines = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0
      );
      await expect(
        new Set(lines.map((rect) => Math.round(rect.top))).size
      ).toBe(1);
      for (const rect of lines) {
        const box = seat.getBoundingClientRect();
        await expect(rect.left).toBeGreaterThanOrEqual(box.left);
        await expect(rect.right).toBeLessThanOrEqual(box.right);
      }
    }
  }
}
