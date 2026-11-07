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
  await expect(box.width).toBeGreaterThan(view.innerWidth < 880 ? 320 : 600);
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
  await expect(rematch.getBoundingClientRect().bottom).toBeLessThan(
    board.getBoundingClientRect().top
  );
  await expect(canvas.getAllByTestId('custom-game-rematch')).toHaveLength(1);
  await expect(canvas.getAllByTestId('custom-game-history-stats')).toHaveLength(
    1
  );
  if (view.innerWidth < 880) {
    await expect(
      canvas.getByTestId('custom-game-move-strip-place')
    ).toHaveTextContent('Finished');
  }
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
