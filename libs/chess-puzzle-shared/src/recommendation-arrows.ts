/**
 * Chess's drawing of a puzzle's moves on its board: the solution move a
 * hint shows, and one arrow per watcher's suggestion in their colour. The
 * marks and suggestions themselves are the platform's.
 */

import type { BoardArrow, Square } from '@pkgs/chess-board-core-shared/types';

const SQUARE_PATTERN = /^[a-h][1-8]$/;

/** Board coordinate guard (wire payloads carry unvalidated strings). */
export function isBoardSquare(v: unknown): v is Square {
  return typeof v === 'string' && SQUARE_PATTERN.test(v);
}

export const PUZZLE_SOLUTION_ARROW_ID = 'puzzle-solution';

/** The solution arrow, then each suggestion's (`rec:<member>`). */
export function chessPuzzleArrows(args: {
  readonly solution: {
    readonly from: string | null;
    readonly to: string;
  } | null;
  readonly suggestions: readonly {
    readonly by: string;
    readonly from: string;
    readonly to: string;
    readonly color: string;
  }[];
}): readonly BoardArrow[] {
  const solution = args.solution;
  return [
    ...(solution === null || solution.from === null
      ? []
      : [
          {
            from: solution.from as Square,
            to: solution.to as Square,
            id: PUZZLE_SOLUTION_ARROW_ID,
          },
        ]),
    ...args.suggestions.map((suggestion) => ({
      from: suggestion.from as Square,
      to: suggestion.to as Square,
      color: suggestion.color,
      id: `rec:${suggestion.by}`,
    })),
  ];
}
