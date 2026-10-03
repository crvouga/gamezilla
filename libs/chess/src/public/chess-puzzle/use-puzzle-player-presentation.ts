import { type Accessor, createMemo } from 'solid-js';
import { puzzleCommentary } from '../../shared/assistant/puzzle-commentary';
import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { chessPuzzleStatusKindFromState } from '../../shared/puzzle-session/status-kind';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';

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
