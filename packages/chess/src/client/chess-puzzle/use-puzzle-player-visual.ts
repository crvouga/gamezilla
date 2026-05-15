import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import type { Square } from '../chess-board/chess-board-types';
import { usePuzzlePlayerCellFeedback } from './use-puzzle-player-cell-feedback';
import { usePuzzlePlayerPresentation } from './use-puzzle-player-presentation';

export function usePuzzlePlayerVisual(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  themes: readonly string[];
  layoutKey: number;
  orientation: 'white' | 'black';
  showCorrectFlash: boolean;
  interactions: ChessPuzzleInteractionRow[];
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  solvedCrownSquare: Square | null;
}) {
  const { assistant, statusKind } = usePuzzlePlayerPresentation({
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    themes: args.themes,
    layoutKey: args.layoutKey,
    orientation: args.orientation,
    showCorrectFlash: args.showCorrectFlash,
  });
  const cellFeedback = usePuzzlePlayerCellFeedback({
    status: args.status,
    puzzleId: args.puzzleId,
    interactions: args.interactions,
    wrongFromSquare: args.wrongFromSquare,
    wrongToSquare: args.wrongToSquare,
    expectedFromSquare: args.expectedFromSquare,
    solvedCrownSquare: args.solvedCrownSquare,
  });
  return { assistant, statusKind, cellFeedback };
}
