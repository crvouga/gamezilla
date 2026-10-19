import type { CellFeedback, Square } from '@pkgs/chess-board-core-shared/types';

/**
 * How chess's board marks a puzzle's cells: a cross on the square a wrong
 * move ended on (the piece is standing there), a dot on the piece a hint
 * picks.
 */
export function chessPuzzleCellFeedback(marks: {
  readonly wrong: string | null;
  readonly hint: string | null;
}): Partial<Record<Square, CellFeedback>> {
  const out: Partial<Record<Square, CellFeedback>> = {};
  if (marks.wrong !== null) out[marks.wrong as Square] = { kind: 'cross' };
  if (marks.hint !== null)
    out[marks.hint as Square] = { kind: 'dot', corner: 'center' };
  return out;
}
