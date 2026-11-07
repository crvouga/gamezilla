import { expect } from 'storybook/test';

/** Native board rectangle, read without focus, scrolling or visibility helpers. */
export function puzzleRectangle(canvas: HTMLElement) {
  const cells = [
    ...canvas.querySelectorAll<HTMLElement>('button[data-square]'),
  ];
  if (cells.length !== 64)
    throw new Error('Expected the complete chess puzzle board');
  const bounds = cells.map((cell) => cell.getBoundingClientRect());
  const left = Math.min(...bounds.map((rect) => rect.left));
  const top = Math.min(...bounds.map((rect) => rect.top));
  return {
    left,
    top,
    width: Math.max(...bounds.map((rect) => rect.right)) - left,
    height: Math.max(...bounds.map((rect) => rect.bottom)) - top,
  };
}

// regression: chess-puzzle-board-shifts-on-outcome
export async function assertStablePuzzleRectangle(
  canvas: HTMLElement,
  before: ReturnType<typeof puzzleRectangle>
) {
  const after = puzzleRectangle(canvas);
  for (const edge of ['left', 'top', 'width', 'height'] as const)
    await expect(Math.abs(after[edge] - before[edge])).toBeLessThanOrEqual(1);
}

// regression: chess-puzzle-phone-board-too-small
export async function assertPuzzleTouchSize(canvas: HTMLElement) {
  const board = puzzleRectangle(canvas);
  // At the cited 390px phone, 320px gives 40px squares. Smaller hosts
  // retain their available width; no scrolling is used to satisfy this.
  const minimum = Math.min(320, canvas.clientWidth - 52);
  await expect(board.width).toBeGreaterThanOrEqual(minimum);
}
