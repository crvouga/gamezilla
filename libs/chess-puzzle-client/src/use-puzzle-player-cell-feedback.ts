import { deriveChessPuzzleCellFeedback } from '@libs/chess-puzzle-shared/cell-feedback';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import type {
  CellHighlight,
  Square,
} from '@pkgs/chess-board-core-shared/types';
import { type Accessor, createMemo } from 'solid-js';

export function usePuzzlePlayerCellFeedback(args: {
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  wrongToSquare: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
}): {
  cellFeedback: Accessor<ReturnType<typeof deriveChessPuzzleCellFeedback>>;
  cellHighlights: Accessor<Partial<Record<Square, CellHighlight>>>;
} {
  const cellFeedback = createMemo(() =>
    deriveChessPuzzleCellFeedback({
      status: args.status(),
      wrongToSquare: args.wrongToSquare(),
      expectedFromSquare: args.expectedFromSquare(),
    })
  );

  const cellHighlights = (): Partial<Record<Square, CellHighlight>> => ({});

  return { cellFeedback, cellHighlights };
}
