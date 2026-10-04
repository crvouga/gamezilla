import type { ChessPuzzleInteractionKind } from './chess-puzzle-interaction-entities';
import { CHESS_PUZZLE_INTERACTION_KIND } from './chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from './chess-puzzle-play-attr';
import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';

type AppendInteraction = (
  kind: ChessPuzzleInteractionKind,
  extra?: {
    uci?: string | null;
    correct?: boolean | null;
    solveIdx?: number;
  }
) => void;

type RoomStatus = ChessPuzzlePlayStatus | 'loading';

type SyncCtx = {
  prev: RoomStatus | null;
  status: RoomStatus;
  myId: string;
  solveIdx: number;
  prevSolveIdx: number | null;
  lastUci: string | null;
  appendInteraction: AppendInteraction;
};

function appendMoveIfNeeded(ctx: SyncCtx): void {
  const { prev, status, solveIdx, prevSolveIdx, lastUci } = ctx;
  if (prev !== CHESS_PUZZLE_PLAY_STATUS.solving || lastUci === null) return;
  if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
    ctx.appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
      uci: lastUci,
      correct: false,
      solveIdx: prevSolveIdx ?? solveIdx,
    });
    return;
  }
  const advanced =
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.solved;
  if (!advanced || prevSolveIdx === null || solveIdx <= prevSolveIdx) return;
  ctx.appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
    uci: lastUci,
    correct: true,
    solveIdx: prevSolveIdx,
  });
}

/**
 * Mirrors one room status transition into the append-only interaction log:
 * the solver's move (right or wrong). Starts and decided results are
 * recorded separately, so results survive navigation and restoration.
 */
export function syncInteractionForRoomStatus(args: SyncCtx): void {
  if (args.myId.length === 0 || args.status === 'loading') return;
  appendMoveIfNeeded(args);
}
