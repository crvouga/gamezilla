import { expect, within } from 'storybook/test';

/** Measure before any click/focus can scroll a hidden control into view. */
export async function numberlinkGeometry(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const board = canvas.getByTestId('numberlink-board').getBoundingClientRect();
  const progress = canvas
    .getByTestId('numberlink-progress')
    .getBoundingClientRect();
  const recovery = canvas
    .getByRole('button', { name: 'Remove a path' })
    .getBoundingClientRect();
  const undo = canvas
    .getByRole('button', { name: 'Undo' })
    .getBoundingClientRect();
  await expect(board.width).toBeGreaterThan(0);
  await expect(progress.top - board.bottom).toBeGreaterThanOrEqual(0);
  await expect(progress.top - board.bottom).toBeLessThanOrEqual(16);
  for (const box of [board, progress, recovery, undo]) {
    await expect(box.top).toBeGreaterThanOrEqual(0);
    await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(box.left).toBeGreaterThanOrEqual(0);
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
  }
  await expect(recovery.height).toBeGreaterThanOrEqual(44);
  return undo.top;
}
