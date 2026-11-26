import { expect, userEvent, within } from 'storybook/test';

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
  // Every seat and the status line read above the board (the owner's stage
  // order), and the board still starts in the first screen's upper half.
  await expect(box.top).toBeLessThan(
    terminal ? 440 : view.innerWidth < 880 ? 380 : 280
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
  // The ending is a dialog over the final board, with the next actions in
  // it; closing it gives the whole final position back, unmoved.
  const dialog = canvas.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.contains(headline)).toBe(true);
  await expect(dialog.contains(rematch)).toBe(true);
  const before = board.getBoundingClientRect();
  await userEvent.click(canvas.getByTestId('game-result-close'));
  const after = board.getBoundingClientRect();
  await expect([after.top, after.left, after.width, after.height]).toEqual([
    before.top,
    before.left,
    before.width,
    before.height,
  ]);
  await userEvent.click(canvas.getByTestId('game-show-result'));
  await expect(canvas.getAllByTestId('custom-game-rematch')).toHaveLength(1);
  await expect(canvas.getAllByTestId('custom-game-history-stats')).toHaveLength(
    1
  );
}

/**
 * Four seats on a phone stand in two rows of two, every seat in view, each
 * with its readable facts.
 */
export async function expectFourSeatRail(seats: HTMLElement[]) {
  const boxes = seats.map((seat) => seat.getBoundingClientRect());
  const [first, second, third, fourth] = boxes;
  if (!first || !second || !third || !fourth)
    throw new Error('Four seats are required');
  // Rows of two: each row's seats side by side at one top, the second row
  // under the first, every seat wholly inside the window.
  for (const [left, right] of [
    [first, second],
    [third, fourth],
  ] as const) {
    await expect(right.top).toBe(left.top);
    await expect(right.left).toBeGreaterThanOrEqual(left.right);
  }
  await expect(third.top).toBeGreaterThanOrEqual(first.bottom);
  await expect(third.left).toBe(first.left);
  await expect(first.left).toBeGreaterThanOrEqual(0);
  await expect(second.right).toBeLessThanOrEqual(window.innerWidth);
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
