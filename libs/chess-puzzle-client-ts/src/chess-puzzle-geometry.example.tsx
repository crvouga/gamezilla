import { expect } from 'storybook/test';
import { puzzleRectangle } from './puzzle-rectangle.example';

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
