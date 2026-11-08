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
  let scrollTop = 0;
  let scrollLeft = 0;
  for (
    let parent = cells[0]?.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    scrollTop += parent.scrollTop;
    scrollLeft += parent.scrollLeft;
  }
  return {
    left,
    top,
    width: Math.max(...bounds.map((rect) => rect.right)) - left,
    height: Math.max(...bounds.map((rect) => rect.bottom)) - top,
    scrollTop,
    scrollLeft,
  };
}

// regression: chess-puzzle-board-shifts-on-outcome
export async function assertStablePuzzleRectangle(
  canvas: HTMLElement,
  before: ReturnType<typeof puzzleRectangle>,
  step: 'solved' | 'wrong-move' | 'retry' | 'keyboard-help'
) {
  const after = puzzleRectangle(canvas);
  for (const edge of ['left', 'top', 'width', 'height'] as const)
    await expect(
      Math.abs(after[edge] - before[edge]),
      `${step} ${edge}: ${JSON.stringify({ before, after })}`
    ).toBeLessThanOrEqual(1);
}

// regression: chess-puzzle-phone-board-too-small
export async function assertPuzzleTouchSize(canvas: HTMLElement) {
  const board = puzzleRectangle(canvas);
  // At the cited 390px phone, 320px gives 40px squares. Smaller hosts
  // retain their available width; no scrolling is used to satisfy this.
  const minimum = Math.min(320, canvas.clientWidth - 52);
  await expect(board.width).toBeGreaterThanOrEqual(minimum);
}
