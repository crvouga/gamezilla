import { type Accessor, createMemo } from 'solid-js';

import { chessPuzzleStatusKindFromState } from '../../shared/puzzle-session/status-kind';
import {
  type ChessPuzzleDialogueBoardContext,
  useChessPuzzleAssistant,
} from '../assistant/use-chess-puzzle-assistant';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';

export function usePuzzlePlayerPresentation(args: {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  themes: Accessor<readonly string[]>;
  layoutKey: Accessor<number>;
  orientation: Accessor<'white' | 'black'>;
  showCorrectFlash: Accessor<boolean>;
  displayFen: Accessor<string | null>;
  totalTokens: Accessor<number>;
  wrongFromSquare: Accessor<string | null>;
  wrongToSquare: Accessor<string | null>;
  rating: Accessor<number>;
}) {
  const board = createMemo<ChessPuzzleDialogueBoardContext>(() => ({
    orientation: args.orientation(),
    displayFen: args.displayFen(),
    solveIdx: args.solveIdx(),
    totalTokens: args.totalTokens(),
    wrongFromSquare: args.wrongFromSquare(),
    wrongToSquare: args.wrongToSquare(),
    ...(args.rating() > 0 ? { puzzleRating: args.rating() } : {}),
  }));

  const assistant = useChessPuzzleAssistant({
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    themes: args.themes,
    layoutKey: args.layoutKey,
    board,
  });

  const statusKind = createMemo(() =>
    chessPuzzleStatusKindFromState({
      status: args.status(),
      orientation: args.orientation(),
      showCorrectFlash: args.showCorrectFlash(),
    })
  );

  return { assistant, statusKind };
}
