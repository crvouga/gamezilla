import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';

type AppendInteraction = (
  kind: ChessPuzzleInteractionKind,
  extra?: {
    uci?: string | null;
    correct?: boolean | null;
    solveIdx?: number;
  }
) => void;

type SyncCtx = {
  prev: ChessPuzzlePlayStatus | 'loading' | null;
  status: ChessPuzzlePlayStatus | 'loading';
  myId: string;
  solveIdx: number;
  prevSolveIdx: number | null;
  lastUci: string | null;
  /** Current play already wrote a solved terminal (skip re-finalize). */
  playAlreadySolved: boolean;
  appendInteraction: AppendInteraction;
  finalizePlay: (k: 'solved') => void;
};

function appendStartedIfNeeded(ctx: SyncCtx): boolean {
  const { prev, status, appendInteraction } = ctx;
  if (prev !== null && prev !== 'loading') return false;
  if (status === CHESS_PUZZLE_PLAY_STATUS.solving) {
    appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.started);
  }
  return true;
}

function appendWrongMoveIfNeeded(ctx: SyncCtx): boolean {
  const { prev, status, solveIdx, prevSolveIdx, lastUci, appendInteraction } =
    ctx;
  if (prev !== CHESS_PUZZLE_PLAY_STATUS.solving) return false;
  if (status !== CHESS_PUZZLE_PLAY_STATUS.wrong) return false;
  appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
    uci: lastUci,
    correct: false,
    solveIdx: prevSolveIdx ?? solveIdx,
  });
  return true;
}

function appendCorrectMoveIfNeeded(ctx: SyncCtx): boolean {
  const { prev, status, solveIdx, prevSolveIdx, lastUci, appendInteraction } =
    ctx;
  if (prev !== CHESS_PUZZLE_PLAY_STATUS.solving) return false;
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) return false;
  if (lastUci === null) return false;
  if (prevSolveIdx === null || solveIdx <= prevSolveIdx) return false;
  appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.moved, {
    uci: lastUci,
    correct: true,
    solveIdx: prevSolveIdx,
  });
  return true;
}

function finalizeSolvedIfNeeded(ctx: SyncCtx): void {
  const { prev, status, finalizePlay, playAlreadySolved } = ctx;
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return;
  if (prev === 'solved') return;
  // Step-back from solved then step-forward / re-solve must not re-rate.
  if (playAlreadySolved) return;
  finalizePlay('solved');
}

/**
 * Mirrors room status transitions into the append-only interaction log.
 */
export function syncInteractionForRoomStatus(args: SyncCtx): void {
  if (args.myId.length === 0 || args.status === 'loading') return;
  if (appendStartedIfNeeded(args)) return;
  if (appendWrongMoveIfNeeded(args)) return;
  if (appendCorrectMoveIfNeeded(args)) return;
  finalizeSolvedIfNeeded(args);
}
