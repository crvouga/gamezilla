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
  // Measured squares leave out the page inset (2 x 16), the rank labels and
  // their gap (16 + 4) and the board's own 2px frame on each side (4):
  // at 320px that is 288 - 20 - 4 = 264px of squares, the whole column.
  const chrome = 2 * 16 + 16 + 4 + 2 * 2;
  // A short landscape window limits the board by height instead: its left
  // column is the window less the 52px host bar and a 16px gap, and the
  // squares leave out the file labels (20) and frame (4), with 2px rounding.
  const view = canvas.ownerDocument.defaultView;
  const height =
    view && view.innerWidth > view.innerHeight
      ? view.innerHeight - (52 + 16 + 20 + 4 + 2)
      : Number.POSITIVE_INFINITY;
  const minimum = Math.min(320, canvas.clientWidth - chrome, height);
  await expect(board.width).toBeGreaterThanOrEqual(minimum);
}
