/**
 * Staging the line's moves on the board: the opponent's setup move and
 * replies, and a shown solution, play out one at a time over the game's
 * own rules (`positionAt`), so a person sees each move happen.
 */
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import type { PuzzleGame } from './puzzle-setup';
import { positionAt } from './puzzle-setup';
import { lineActions } from './step';

/** The position after `solveIdx` actions of the stored line. */
function positionAtSolveIdx(
  game: PuzzleGame,
  args: { position: string; moves: string; solveIdx: number }
): string | null {
  return positionAt(
    game,
    args.position,
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
  readonly position: string;
  readonly atMs: number;
};

export type OpponentStagePlan =
  | { readonly kind: 'snap'; readonly boardPosition: string }
  | {
      readonly kind: 'animate';
      /** Shown at once (input locked). */
      readonly fromPosition: string;
      /** Shown in order; input unlocks one piece-move after the last. */
      readonly frames: readonly OpponentStageFrame[];
    };

type StageArgs = {
  /** The game whose rules play the line. */
  game: PuzzleGame;
  startPosition: string;
  moves: string;
  displayPosition: string;
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
  if (puzzleLineLayout(args.game.puzzles).solverStep === 1) return null;
  if (!isFreshOpening(args) || wasAlreadyAtOpening(args)) return null;
  if (
    args.startPosition.length === 0 ||
    args.startPosition === args.displayPosition
  ) {
    return null;
  }
  return {
    kind: 'animate',
    fromPosition: args.startPosition,
    frames: [
      { position: args.displayPosition, atMs: PUZZLE_OPENING_PREVIEW_MS },
    ],
  };
}

function planReplyAnimate(args: StageArgs): OpponentStagePlan | null {
  if (puzzleLineLayout(args.game.puzzles).solverStep === 1) return null;
  if (args.revealed || !hasNewProgress(args)) return null;
  if (args.solveIdx !== args.prevSolveIdx + 2) return null;
  const fromPosition = positionAtSolveIdx(args.game, {
    position: args.startPosition,
    moves: args.moves,
    solveIdx: args.solveIdx - 1,
  });
  if (fromPosition === null || fromPosition === args.displayPosition)
    return null;
  return {
    kind: 'animate',
    fromPosition,
    frames: [{ position: args.displayPosition, atMs: PUZZLE_REPLY_PREVIEW_MS }],
  };
}

/** Every remaining ply of the line, one per {@link PUZZLE_SOLUTION_STEP_MS}. */
function planSolutionAnimate(args: StageArgs): OpponentStagePlan | null {
  if (!args.revealed || !hasNewProgress(args)) return null;
  if (
    args.prevSolveIdx < puzzleLineLayout(args.game.puzzles).start ||
    args.prevSolveIdx >= args.solveIdx
  )
    return null;
  const reachedAt = (solveIdx: number): string | null =>
    positionAtSolveIdx(args.game, {
      position: args.startPosition,
      moves: args.moves,
      solveIdx,
    });
  const fromPosition = reachedAt(args.prevSolveIdx);
  if (fromPosition === null) return null;
  const frames: OpponentStageFrame[] = [];
  for (let idx = args.prevSolveIdx + 1; idx <= args.solveIdx; idx += 1) {
    const position = reachedAt(idx);
    if (position === null) return null;
    frames.push({
      position,
      atMs: (idx - args.prevSolveIdx) * PUZZLE_SOLUTION_STEP_MS,
    });
  }
  return { kind: 'animate', fromPosition, frames };
}

/**
 * Decides whether the board should snap to `displayPosition` or animate opponent
 * plies first (the opening, a reply to a correct move, a shown solution).
 *
 * Opening animates on start and retry. Replies animate when furthest advances
 * by a human+opponent pair. "Show solution" plays every remaining ply. Seek /
 * scrub snaps.
 */
export function planOpponentStage(args: StageArgs): OpponentStagePlan {
  if (args.displayPosition.length === 0) {
    return { kind: 'snap', boardPosition: args.displayPosition };
  }
  return (
    planSolutionAnimate(args) ??
    planOpeningAnimate(args) ??
    planReplyAnimate(args) ?? {
      kind: 'snap',
      boardPosition: args.displayPosition,
    }
  );
}
