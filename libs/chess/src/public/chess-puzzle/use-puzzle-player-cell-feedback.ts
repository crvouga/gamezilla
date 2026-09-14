import type {
  CellHighlight,
  Square,
} from '@pkgs/chess-board/chess-board-types';
import { type Accessor, createMemo } from 'solid-js';

import { deriveChessPuzzleCellFeedback } from '../../shared/puzzle-session/cell-feedback';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';

export function usePuzzlePlayerCellFeedback(args: {
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  wrongFromSquare: Accessor<string | null>;
  wrongToSquare: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
}): {
  cellFeedback: Accessor<ReturnType<typeof deriveChessPuzzleCellFeedback>>;
  cellHighlights: Accessor<Partial<Record<Square, CellHighlight>>>;
} {
  const cellFeedback = createMemo(() =>
    deriveChessPuzzleCellFeedback({
      status: args.status(),
      wrongFromSquare: args.wrongFromSquare(),
      wrongToSquare: args.wrongToSquare(),
      expectedFromSquare: args.expectedFromSquare(),
    })
  );

  const cellHighlights = (): Partial<Record<Square, CellHighlight>> => ({});

  return { cellFeedback, cellHighlights };
}
