import { useLayoutEffect } from 'react';

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
 * `reset` itself no-ops when the live instance already holds `fen` (optimistic
 * drop path), so we only clear interaction chrome when the position actually
 * changes or `fenSyncKey` forces a remount.
 */
export function useExternalFenSync(
  fen: string | undefined,
  fenSyncKey: number | undefined,
  reset: (nextFen: string) => void,
  onAfterReset: () => void
): void {
  useLayoutEffect(() => {
    if (fen === undefined || fen.length === 0) return;
    reset(fen);
    onAfterReset();
  }, [fen, fenSyncKey, reset, onAfterReset]);
}
