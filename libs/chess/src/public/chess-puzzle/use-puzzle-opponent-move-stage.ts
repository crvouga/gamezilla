import { useTimers } from '@pkgs/clock';
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  createPuzzleOpponentStager,
  type OpponentStagerInput,
  type OpponentStagerSnapshot,
} from '../chess-puzzle-opponent-stager';

export type PuzzleOpponentMoveStage = OpponentStagerSnapshot;

/**
 * Stages opponent opening / reply plies on the board before unlocking input,
 * matching chess.com puzzle UX. Room state stays authoritative; this only
 * delays the fen shown to the board. Thin React binding over
 * {@link createPuzzleOpponentStager}.
 */
export function usePuzzleOpponentMoveStage(
  args: OpponentStagerInput
): PuzzleOpponentMoveStage {
  const timers = useTimers();
  const [stager] = useState(() => createPuzzleOpponentStager(timers));
  useEffect(() => () => stager.dispose(), [stager]);

  // Layout effect: the first paint after a room change must already show
  // the staged (pre-ply) FEN, not the authoritative one.
  useLayoutEffect(() => {
    stager.update(args);
  }, [
    stager,
    args.startFen,
    args.moves,
    args.displayFen,
    args.solveIdx,
    args.furthestSolveIdx,
    args.status,
  ]);

  return useSyncExternalStore(
    stager.subscribe,
    stager.getSnapshot,
    stager.getSnapshot
  );
}
