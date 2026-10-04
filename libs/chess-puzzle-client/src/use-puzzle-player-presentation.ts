import { type Accessor, createMemo } from 'solid-js';
import { puzzleCommentary } from '@libs/chess-puzzle-shared/puzzle-commentary';
import type { HintStage } from '@libs/chess-puzzle-shared/hint-stage';
import { chessPuzzleStatusKindFromState } from '@libs/chess-puzzle-shared/status-kind';
import type { ChessPuzzlePlayStatus } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';

export function usePuzzlePlayerPresentation(args: {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  layoutKey: Accessor<number>;
  displayFen: Accessor<string | null>;
  wrongUci: Accessor<string | null>;
  hintStage: Accessor<HintStage>;
  opponentReplying: Accessor<boolean>;
  viewingHistory: Accessor<boolean>;
}) {
  const assistant = createMemo(() =>
    puzzleCommentary({
      puzzleId: args.puzzleId(),
      fen: args.displayFen(),
      status: args.status(),
      solveIdx: args.solveIdx(),
      layoutKey: args.layoutKey(),
      wrongUci: args.wrongUci(),
      hint: args.hintStage(),
      opponentReplying: args.opponentReplying(),
      viewingHistory: args.viewingHistory(),
    })
  );
  const statusKind = createMemo(() =>
    chessPuzzleStatusKindFromState({ status: args.status() })
  );
  return { assistant, statusKind };
}
