import { useEffect } from 'react';

/**
 * When FEN is owned by the parent (puzzles, replays), re-apply it to the local
 * chess.js instance whenever it changes so the canvas matches without remounting.
 */
export function useExternalFenSync(
  fen: string | undefined,
  reset: (nextFen: string) => void,
  onAfterReset: () => void
): void {
  useEffect(() => {
    if (fen === undefined || fen.length === 0) return;
    reset(fen);
    onAfterReset();
  }, [fen, reset, onAfterReset]);
}
