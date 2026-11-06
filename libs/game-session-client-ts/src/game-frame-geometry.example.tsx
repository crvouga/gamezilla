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
    ).toHaveTextContent('Final');
  }
}
