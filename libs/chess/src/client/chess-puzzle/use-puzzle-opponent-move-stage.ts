import { useLayoutEffect, useRef, useState } from 'react';

import {
  planOpponentStage,
  PUZZLE_OPPONENT_UNLOCK_BUFFER_MS,
  PUZZLE_PIECE_MOVE_MS,
  type OpponentStagePlan,
} from '../../shared/chess-puzzle-opponent-stage';
import type { SolveStatus } from './use-chess-puzzle-solver';

export type PuzzleOpponentMoveStage = {
  boardFen: string | null;
  /** True while an opponent ply is previewing / sliding — lock human input. */
  opponentAnimating: boolean;
};

type StagePhase = {
  fen: string;
  locked: boolean;
};

function applyPlanTimers(
  plan: Extract<OpponentStagePlan, { kind: 'animate' }>,
  setPhase: (phase: StagePhase | null) => void
): () => void {
  setPhase({ fen: plan.fromFen, locked: true });
  const moveMs = PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS;
  const t1 = setTimeout(() => {
    setPhase({ fen: plan.toFen, locked: true });
  }, plan.holdMs);
  const t2 = setTimeout(() => {
    setPhase(null);
  }, plan.holdMs + moveMs);
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
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
  const {
    startFen,
    moves,
    displayFen,
    solveIdx,
    furthestSolveIdx,
    status,
  } = args;
  const prevRef = useRef({ solveIdx: -1, furthestSolveIdx: -1 });
  const [phase, setPhase] = useState<StagePhase | null>(null);

  useLayoutEffect(() => {
    if (displayFen === null || displayFen.length === 0) {
      prevRef.current = { solveIdx, furthestSolveIdx };
      setPhase(null);
      return;
    }
    if (status === 'loading' || status === 'idle' || status === 'invalid') {
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
    return applyPlanTimers(plan, setPhase);
  }, [displayFen, furthestSolveIdx, moves, solveIdx, startFen, status]);

  return {
    boardFen: phase?.fen ?? displayFen,
    opponentAnimating: phase?.locked === true,
  };
}
