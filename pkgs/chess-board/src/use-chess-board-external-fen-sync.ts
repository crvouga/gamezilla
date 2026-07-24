import { useLayoutEffect, useRef } from 'react';

import type { ApplyExternalFenResult } from './chess-board-apply-external-fen';
import type { PostMoveAudio } from './chess-board-schedule-move-sound';
import type { Move } from './chess-board-types';

type ExternalFenSyncArgs = {
  fen: string | undefined;
  fenSyncKey: number | undefined;
  /** Live board FEN before this sync (detects optimistic desync / wrong-move revert). */
  localFen: string;
  applyExternalFen: (nextFen: string) => ApplyExternalFenResult | null;
  commitMoveUi: (move: Move) => void;
  clearLastMove: () => void;
  onAfterReset: () => void;
  applySuccessfulMove: (move: Move, post: PostMoveAudio) => void;
};

/**
 * When FEN is owned by the parent (puzzles, replays), re-apply it to the local
 * chess.js instance whenever it changes so the canvas matches without remounting.
 * `fenSyncKey` re-runs the sync when the FEN string is unchanged (e.g. controlled
 * board after a rejected try).
 *
 * Uses `useLayoutEffect` so the local rules state is mutated BEFORE the browser
 * paints — eliminates a one-frame stale board between `fen` prop change and the
 * canvas reconcile (visible as a flash during puzzle transitions on mobile).
 *
 * Same-FEN no-ops inside `applyExternalFen`. Single-ply external changes that
 * happen while the board is still in sync with the last props FEN set lastMove
 * and play move SFX (opponent opening / canned reply). Optimistic desync
 * repairs (wrong-move revert) stay silent.
 *
 * `localFen` is read via ref on purpose — it must not be an effect dependency
 * or optimistic drops would immediately re-sync back to the stale props FEN.
 */
export function useExternalFenSync(args: ExternalFenSyncArgs): void {
  const {
    fen,
    fenSyncKey,
    localFen,
    applyExternalFen,
    commitMoveUi,
    clearLastMove,
    onAfterReset,
    applySuccessfulMove,
  } = args;
  const prevFenPropRef = useRef<string | undefined>(undefined);
  const localFenRef = useRef(localFen);
  localFenRef.current = localFen;

  useLayoutEffect(() => {
    if (fen === undefined || fen.length === 0) return;
    const prevProp = prevFenPropRef.current;
    const wasInSync =
      prevProp === undefined || localFenRef.current === prevProp;
    const result = applyExternalFen(fen);
    prevFenPropRef.current = fen;
    onAfterReset();
    if (result === null) return;
    if (result.moved !== null && wasInSync) {
      commitMoveUi(result.moved);
      applySuccessfulMove(result.moved, {
        inCheck: result.inCheck,
        isGameOver: result.isGameOver,
      });
      return;
    }
    clearLastMove();
  }, [
    fen,
    fenSyncKey,
    applyExternalFen,
    commitMoveUi,
    clearLastMove,
    onAfterReset,
    applySuccessfulMove,
  ]);
}
