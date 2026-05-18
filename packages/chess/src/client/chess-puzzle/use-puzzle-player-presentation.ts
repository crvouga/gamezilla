import { useMemo } from 'react';

import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import {
  useChessPuzzleAssistant,
  type ChessPuzzleDialogueBoardContext,
} from '../assistant/use-chess-puzzle-assistant';
import { chessPuzzleStatusKindFromState } from './chess-puzzle-status-from-state';

export function usePuzzlePlayerPresentation(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  themes: readonly string[];
  layoutKey: number;
  orientation: 'white' | 'black';
  showCorrectFlash: boolean;
  displayFen: string | null;
  totalTokens: number;
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  rating: number;
}) {
  const {
    puzzleId,
    status,
    solveIdx,
    themes,
    layoutKey,
    orientation,
    showCorrectFlash,
    displayFen,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    rating,
  } = args;

  const board = useMemo<ChessPuzzleDialogueBoardContext>(
    () => ({
      orientation,
      displayFen,
      solveIdx,
      totalTokens,
      wrongFromSquare,
      wrongToSquare,
      ...(rating > 0 ? { puzzleRating: rating } : {}),
    }),
    [
      orientation,
      displayFen,
      solveIdx,
      totalTokens,
      wrongFromSquare,
      wrongToSquare,
      rating,
    ]
  );

  const assistant = useChessPuzzleAssistant({
    puzzleId,
    status,
    solveIdx,
    themes,
    layoutKey,
    board,
  });

  const statusKind = chessPuzzleStatusKindFromState({
    status,
    orientation,
    showCorrectFlash,
  });

  return { assistant, statusKind };
}
