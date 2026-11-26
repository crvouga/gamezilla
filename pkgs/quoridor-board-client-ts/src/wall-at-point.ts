import type { Point } from './board-camera';

/** Map the playable lattice only. Headers, the outer rim and square centres
 * are never wall targets. Rectangles include the current zoom and pan. */
export function wallAtPoint(board: HTMLElement, point: Point): string | null {
  const first = board
    .querySelector('[data-cell="a9"]')
    ?.getBoundingClientRect();
  const last = board.querySelector('[data-cell="i1"]')?.getBoundingClientRect();
  if (!first || !last || last.left <= first.left || last.top <= first.top)
    return null;
  if (
    point.x < first.left ||
    point.x > last.right ||
    point.y < first.top ||
    point.y > last.bottom
  )
    return null;
  const x =
    ((point.x - first.left - first.width / 2) * 8) / (last.left - first.left) +
    0.5;
  const y =
    ((point.y - first.top - first.height / 2) * 8) / (last.top - first.top) +
    0.5;
  const column = Math.round(x);
  const row = Math.round(y);
  const vertical = column > 0 && column < 9 ? Math.abs(column - x) : 1;
  const horizontal = row > 0 && row < 9 ? Math.abs(row - y) : 1;
  if (Math.min(vertical, horizontal) > 0.2) return null;
  const file = Math.max(1, Math.min(8, column));
  const rank = 9 - Math.max(1, Math.min(8, row));
  return (
    String.fromCharCode(96 + file) + rank + (horizontal <= vertical ? 'h' : 'v')
  );
}
