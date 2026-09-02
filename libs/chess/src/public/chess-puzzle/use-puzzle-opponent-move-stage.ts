import type { Timers } from '@pkgs/clock';
import { useTimers } from '@pkgs/clock';
import { useLayoutEffect, useRef, useState } from 'react';

import {
  type OpponentStagePlan,
  PUZZLE_OPPONENT_UNLOCK_BUFFER_MS,
  PUZZLE_PIECE_MOVE_MS,
  planOpponentStage,
} from '../chess-puzzle-opponent-stage';
import type { SolveStatus } from './solve-status';

export type PuzzleOpponentMoveStage = {
  boardFen: string | null;
  /** True while an opponent ply is previewing / sliding — lock human input. */
  opponentAnimating: boolean;
};

type StagePhase = {
  fen: string;
  locked: boolean;
};

type PrevSolveCursor = {
  solveIdx: number;
  furthestSolveIdx: number;
};

type AnimatePlan = Extract<OpponentStagePlan, { kind: 'animate' }>;

function isBusyStatus(status: SolveStatus): boolean {
  return status === 'loading' || status === 'idle' || status === 'invalid';
}

function pendingAnimatePlan(args: {
  startFen: string;
  moves: string;
  displayFen: string;
  solveIdx: number;
  furthestSolveIdx: number;
  prev: PrevSolveCursor;
}): AnimatePlan | null {
  const plan = planOpponentStage({
    startFen: args.startFen,
    moves: args.moves,
    displayFen: args.displayFen,
    solveIdx: args.solveIdx,
    furthestSolveIdx: args.furthestSolveIdx,
    prevSolveIdx: args.prev.solveIdx,
    prevFurthestSolveIdx: args.prev.furthestSolveIdx,
  });
  return plan.kind === 'animate' ? plan : null;
}

/**
 * Hold `fromFen` briefly, then slide to `toFen`. Uses injected timers only
 * (no requestAnimationFrame) so sim pumps unlock the board deterministically.
 */
function applyPlanTimers(
  plan: AnimatePlan,
  setPhase: (phase: StagePhase | null) => void,
  timers: Timers
): () => void {
  setPhase({ fen: plan.fromFen, locked: true });
  const moveMs = PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS;
  let t1: unknown;
  let t2: unknown;
  // One 0ms tick approximates "after mount" without wall rAF.
  const t0 = timers.setTimeout(() => {
    t1 = timers.setTimeout(() => {
      setPhase({ fen: plan.toFen, locked: true });
    }, plan.holdMs);
    t2 = timers.setTimeout(() => {
      setPhase(null);
    }, plan.holdMs + moveMs);
  }, 0);
  return () => {
    timers.clearTimeout(t0);
    if (t1 !== undefined) timers.clearTimeout(t1);
    if (t2 !== undefined) timers.clearTimeout(t2);
  };
}

function resolveBoardFen(
  phase: StagePhase | null,
  displayFen: string | null,
  pending: AnimatePlan | null
): string | null {
  if (phase !== null) return phase.fen;
  if (pending !== null) return pending.fromFen;
  return displayFen;
}

/**
 * Stages opponent opening / reply plies on the board before unlocking input,
 * matching chess.com puzzle UX. Room state stays authoritative; this only
 * delays the fen shown to {@link ChessBoard}.
 *
 * Timing constants live in shared (not `@pkgs/chess-board/chess-board-piece`)
 * so this module never statically pulls `@shopify/react-native-skia` into the
 * eager chess chunk before CanvasKit finishes loading on web.
 */
export function usePuzzleOpponentMoveStage(args: {
  startFen: string;
  moves: string;
  displayFen: string | null;
  solveIdx: number;
  furthestSolveIdx: number;
  status: SolveStatus;
}): PuzzleOpponentMoveStage {
  const { startFen, moves, displayFen, solveIdx, furthestSolveIdx, status } =
    args;
  const timers = useTimers();
  const prevRef = useRef<PrevSolveCursor>({
    solveIdx: -1,
    furthestSolveIdx: -1,
  });
  const [phase, setPhase] = useState<StagePhase | null>(null);

  const canStage =
    displayFen !== null && displayFen.length > 0 && !isBusyStatus(status);
  const pendingAnimate = canStage
    ? pendingAnimatePlan({
        startFen,
        moves,
        displayFen,
        solveIdx,
        furthestSolveIdx,
        prev: prevRef.current,
      })
    : null;

  useLayoutEffect(() => {
    if (!canStage || displayFen === null) {
      prevRef.current = { solveIdx, furthestSolveIdx };
      setPhase(null);
      return;
    }

    const prev = prevRef.current;
    const plan = planOpponentStage({
      startFen,
      moves,
      displayFen,
      solveIdx,
      furthestSolveIdx,
      prevSolveIdx: prev.solveIdx,
      prevFurthestSolveIdx: prev.furthestSolveIdx,
    });
    prevRef.current = { solveIdx, furthestSolveIdx };

    if (plan.kind === 'snap') {
      setPhase(null);
      return;
    }
    return applyPlanTimers(plan, setPhase, timers);
  }, [
    canStage,
    displayFen,
    furthestSolveIdx,
    moves,
    solveIdx,
    startFen,
    status,
    timers,
  ]);

  return {
    boardFen: resolveBoardFen(phase, displayFen, pendingAnimate),
    opponentAnimating: phase?.locked === true || pendingAnimate !== null,
  };
}
