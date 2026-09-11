import { fenAtSolveIdx } from './chess-puzzle-step';

export const PUZZLE_OPENING_PREVIEW_MS = 450;
export const PUZZLE_REPLY_PREVIEW_MS = 280;
/** Keep in sync with `@pkgs/chess-board` `MOVE_DURATION_MS` (do not import it). */
export const PUZZLE_PIECE_MOVE_MS = 150;
export const PUZZLE_OPPONENT_UNLOCK_BUFFER_MS = 80;

export type OpponentStagePlan =
  | { readonly kind: 'snap'; readonly boardFen: string }
  | {
      readonly kind: 'animate';
      readonly fromFen: string;
      readonly toFen: string;
      readonly holdMs: number;
    };

type StageArgs = {
  startFen: string;
  moves: string;
  displayFen: string;
  solveIdx: number;
  furthestSolveIdx: number;
  prevSolveIdx: number;
  prevFurthestSolveIdx: number;
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
    toFen: args.displayFen,
    holdMs: PUZZLE_OPENING_PREVIEW_MS,
  };
}

function planReplyAnimate(args: StageArgs): OpponentStagePlan | null {
  if (!hasNewProgress(args)) return null;
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
    toFen: args.displayFen,
    holdMs: PUZZLE_REPLY_PREVIEW_MS,
  };
}

/**
 * Decides whether the board should snap to `displayFen` or animate an opponent
 * ply first (chess.com-style opening / canned reply).
 *
 * Opening animates on start and retry. Replies animate when furthest advances
 * by a human+opponent pair. Seek / scrub snaps.
 */
export function planOpponentStage(args: StageArgs): OpponentStagePlan {
  if (args.displayFen.length === 0) {
    return { kind: 'snap', boardFen: args.displayFen };
  }
  return (
    planOpeningAnimate(args) ??
    planReplyAnimate(args) ?? { kind: 'snap', boardFen: args.displayFen }
  );
}
