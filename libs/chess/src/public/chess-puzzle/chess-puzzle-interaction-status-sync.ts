import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleOutcomeKind,
} from '../chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

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
  /** Records the play's rated outcome; the caller makes it at-most-once. */
  recordOutcome: (kind: ChessPuzzleOutcomeKind) => void;
};

/**
 * Outcome a status transition decides (§5 / §6), or null. The first of
 * these per play is the rated one: a wrong move or the solution shown before
 * resolution is a loss, a solve is a win, a skip is an abandon.
 */
export function outcomeForTransition(
  prev: RoomStatus | null,
  status: RoomStatus
): ChessPuzzleOutcomeKind | null {
  // Only a live attempt decides an outcome; a first read after mount or
  // reload (`null` / `loading` → anything) is a restore, never a transition.
  const live =
    prev === CHESS_PUZZLE_PLAY_STATUS.solving ||
    prev === CHESS_PUZZLE_PLAY_STATUS.wrong;
  if (!live || prev === status) return null;
  switch (status) {
    case CHESS_PUZZLE_PLAY_STATUS.wrong:
    case CHESS_PUZZLE_PLAY_STATUS.revealed:
      return CHESS_PUZZLE_INTERACTION_KIND.failed;
    case CHESS_PUZZLE_PLAY_STATUS.solved:
      return CHESS_PUZZLE_INTERACTION_KIND.solved;
    case CHESS_PUZZLE_PLAY_STATUS.skipped:
      return CHESS_PUZZLE_INTERACTION_KIND.abandoned;
    default:
      return null;
  }
}

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
 * the solver's move (right or wrong), then the outcome it decides. The
 * `started` row is written separately, once per room attempt.
 */
export function syncInteractionForRoomStatus(args: SyncCtx): void {
  if (args.myId.length === 0 || args.status === 'loading') return;
  appendMoveIfNeeded(args);
  const outcome = outcomeForTransition(args.prev, args.status);
  if (outcome !== null) args.recordOutcome(outcome);
}
