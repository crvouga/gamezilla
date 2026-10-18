import { positionAt } from '@libs/game-puzzle-shared/puzzle-setup';
import { lineActions } from '@libs/game-puzzle-shared/step';
import { CHESS_PUZZLE_GAME } from './chess-puzzles';

/** The position after `solveIdx` actions of the stored line. */
function fenAtSolveIdx(args: {
  fen: string;
  moves: string;
  solveIdx: number;
}): string | null {
  return positionAt(
    CHESS_PUZZLE_GAME,
    args.fen,
    lineActions(args.moves),
    args.solveIdx
  );
}

/**
 * §5 load: the pre-setup position holds this long before the opponent's
 * setup move slides in (spec: ~400–600 ms).
 */
export const PUZZLE_OPENING_PREVIEW_MS = 500;
/**
 * §5 correct move, line continues: the solver's move holds (green feedback)
 * this long before the opponent's reply plays (spec: ~300–500 ms).
 */
export const PUZZLE_REPLY_PREVIEW_MS = 400;
/** §6 "Show solution": one ply of the remaining line every this many ms. */
export const PUZZLE_SOLUTION_STEP_MS = 600;
/** Parent-chosen slide duration, supplied through the public board option. */
export const PUZZLE_PIECE_MOVE_MS = 150;
export const PUZZLE_OPPONENT_UNLOCK_BUFFER_MS = 80;

/** One board position shown `atMs` after the stage starts. */
export type OpponentStageFrame = {
  readonly fen: string;
  readonly atMs: number;
};

export type OpponentStagePlan =
  | { readonly kind: 'snap'; readonly boardFen: string }
  | {
      readonly kind: 'animate';
      /** Shown at once (input locked). */
      readonly fromFen: string;
      /** Shown in order; input unlocks one piece-move after the last. */
      readonly frames: readonly OpponentStageFrame[];
    };

type StageArgs = {
  startFen: string;
  moves: string;
  displayFen: string;
  solveIdx: number;
  furthestSolveIdx: number;
  prevSolveIdx: number;
  prevFurthestSolveIdx: number;
  /** The room just jumped to the end of the line via "Show solution". */
  revealed: boolean;
};

function isFreshOpening(args: StageArgs): boolean {
  return args.solveIdx === 1 && args.furthestSolveIdx === 1;
}

function wasAlreadyAtOpening(args: StageArgs): boolean {
  return args.prevSolveIdx === 1 && args.prevFurthestSolveIdx === 1;
}

function hasNewProgress(args: StageArgs): boolean {
  return (
    args.furthestSolveIdx === args.solveIdx &&
    args.furthestSolveIdx > args.prevFurthestSolveIdx
  );
}

function planOpeningAnimate(args: StageArgs): OpponentStagePlan | null {
  if (!isFreshOpening(args) || wasAlreadyAtOpening(args)) return null;
  if (args.startFen.length === 0 || args.startFen === args.displayFen) {
    return null;
  }
  return {
    kind: 'animate',
    fromFen: args.startFen,
    frames: [{ fen: args.displayFen, atMs: PUZZLE_OPENING_PREVIEW_MS }],
  };
}

function planReplyAnimate(args: StageArgs): OpponentStagePlan | null {
  if (args.revealed || !hasNewProgress(args)) return null;
  if (args.solveIdx !== args.prevSolveIdx + 2) return null;
  const fromFen = fenAtSolveIdx({
    fen: args.startFen,
    moves: args.moves,
    solveIdx: args.solveIdx - 1,
  });
  if (fromFen === null || fromFen === args.displayFen) return null;
  return {
    kind: 'animate',
    fromFen,
    frames: [{ fen: args.displayFen, atMs: PUZZLE_REPLY_PREVIEW_MS }],
  };
}

/** Every remaining ply of the line, one per {@link PUZZLE_SOLUTION_STEP_MS}. */
function planSolutionAnimate(args: StageArgs): OpponentStagePlan | null {
  if (!args.revealed || !hasNewProgress(args)) return null;
  if (args.prevSolveIdx < 1 || args.prevSolveIdx >= args.solveIdx) return null;
  const fenAt = (solveIdx: number): string | null =>
    fenAtSolveIdx({ fen: args.startFen, moves: args.moves, solveIdx });
  const fromFen = fenAt(args.prevSolveIdx);
  if (fromFen === null) return null;
  const frames: OpponentStageFrame[] = [];
  for (let idx = args.prevSolveIdx + 1; idx <= args.solveIdx; idx += 1) {
    const fen = fenAt(idx);
    if (fen === null) return null;
    frames.push({
      fen,
      atMs: (idx - args.prevSolveIdx) * PUZZLE_SOLUTION_STEP_MS,
    });
  }
  return { kind: 'animate', fromFen, frames };
}

/**
 * Decides whether the board should snap to `displayFen` or animate opponent
 * plies first (chess.com-style opening / canned reply / shown solution).
 *
 * Opening animates on start and retry. Replies animate when furthest advances
 * by a human+opponent pair. "Show solution" plays every remaining ply. Seek /
 * scrub snaps.
 */
export function planOpponentStage(args: StageArgs): OpponentStagePlan {
  if (args.displayFen.length === 0) {
    return { kind: 'snap', boardFen: args.displayFen };
  }
  return (
    planSolutionAnimate(args) ??
    planOpeningAnimate(args) ??
    planReplyAnimate(args) ?? { kind: 'snap', boardFen: args.displayFen }
  );
}
