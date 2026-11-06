import { expect, userEvent, within } from 'storybook/test';

async function assertFocusedCoordinates(
  canvasElement: HTMLElement,
  id: string
) {
  const cell = within(canvasElement).getByTestId(
    `custom-game-board-cell-${id}`
  );
  await expect(cell).toHaveFocus();
  const board = cell.closest('[data-component="WordTileBoard"]');
  const viewport = board?.parentElement;
  if (!board || !viewport) throw new Error('Missing word board viewport');
  const index = Number(cell.dataset['index']);
  const column = board.querySelectorAll('[data-axis="column"]')[index % 15];
  const row =
    board.querySelectorAll('[data-axis="row"]')[Math.floor(index / 15)];
  if (!column || !row) throw new Error('Missing focused coordinates');
  const bounds = cell.getBoundingClientRect();
  const clip = viewport.getBoundingClientRect();
  const top = column.getBoundingClientRect();
  const left = row.getBoundingClientRect();
  await expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(bounds.height).toBeGreaterThanOrEqual(44);
  await expect(top.top).toBeGreaterThanOrEqual(clip.top);
  await expect(left.left).toBeGreaterThanOrEqual(clip.left);
  await expect(bounds.top).toBeGreaterThanOrEqual(top.bottom);
  await expect(bounds.left).toBeGreaterThanOrEqual(left.right);
  await expect(bounds.bottom).toBeLessThanOrEqual(clip.bottom);
  await expect(bounds.right).toBeLessThanOrEqual(clip.right);
  await expect(top.left).toBe(bounds.left);
  await expect(left.top).toBe(bounds.top);
}

/** Keyboard navigation must reveal its cell without concealing either coordinate. */
export async function checkEnlargedCoordinates(canvasElement: HTMLElement) {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: 'Enlarge board' })
  );
  await assertFocusedCoordinates(canvasElement, 'h8');
  for (const [keys, cell] of [
    ['{Control>}{Home}{/Control}', 'a1'],
    ['{End}', 'o1'],
    ['{Control>}{End}{/Control}', 'o15'],
    ['{Home}', 'a15'],
    ['{ArrowUp>7/}{ArrowRight>7/}', 'h8'],
  ] as const) {
    await userEvent.keyboard(keys);
    await assertFocusedCoordinates(canvasElement, cell);
  }
}
