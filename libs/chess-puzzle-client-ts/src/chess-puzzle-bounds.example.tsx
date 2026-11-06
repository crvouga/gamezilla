import { expect, userEvent, within } from 'storybook/test';
import { assertPuzzleTouchSize } from './chess-puzzle-geometry.example';

type Boundary = readonly [
  edge: string,
  actual: number,
  limit: number,
  minimum: boolean,
];

function cellBoundaries(cell: HTMLElement): Boundary[] {
  const bounds = cell.getBoundingClientRect();
  const result: Boundary[] = [
    ['width', bounds.width, 32, true],
    ['height', bounds.height, 32, true],
  ];
  for (let parent = cell.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const clip = parent.getBoundingClientRect();
    if (/hidden|clip|auto|scroll/.test(style.overflowY))
      result.push(
        ['top', bounds.top, clip.top, true],
        ['bottom', bounds.bottom, clip.bottom, false]
      );
    if (/hidden|clip|auto|scroll/.test(style.overflowX))
      result.push(
        ['left', bounds.left, clip.left, true],
        ['right', bounds.right, clip.right, false]
      );
  }
  return result;
}

/** Assert every boundary before input, reporting all violations in one instrumented call. */
export async function assertPuzzleBounds(canvasElement: HTMLElement) {
  const cells = canvasElement.querySelectorAll<HTMLElement>(
    'button[data-square]'
  );
  await expect(cells.length).toBe(64);
  await assertPuzzleTouchSize(canvasElement);
  const violations = [];
  for (const cell of cells) {
    for (const [edge, actual, limit, minimum] of cellBoundaries(cell)) {
      if (!(minimum ? actual >= limit : actual <= limit))
        violations.push({
          square: cell.dataset['square'],
          edge,
          actual,
          limit,
          minimum,
        });
    }
  }
  await expect(violations).toEqual([]);
  const frame = canvasElement.querySelector(
    '[data-component="ChessBoardFrame"]'
  );
  const layout = canvasElement.querySelector(
    '[data-component="ChessBoardLayout"]'
  );
  if (frame && layout)
    await expect(frame.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      layout.getBoundingClientRect().bottom
    );
}

// regression: chess-puzzle-guidance-clips-first-rank
export async function checkPuzzleFirstRank(canvasElement: HTMLElement) {
  await assertPuzzleBounds(canvasElement);
  const canvas = within(canvasElement);
  const king = canvas.getByRole('button', { name: /^e1, White king/ });
  const bounds = king.getBoundingClientRect();
  await userEvent.pointer({
    target: canvas.getByRole('application', { name: /Chess board/ }),
    coords: {
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    },
    keys: '[MouseLeft]',
  });
  await expect(king).toHaveAttribute('aria-pressed', 'true');
  await expect(
    canvas.getByRole('button', { name: /^f1, empty, Legal destination/ })
  ).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect(king).toHaveAttribute('aria-pressed', 'false');
}
