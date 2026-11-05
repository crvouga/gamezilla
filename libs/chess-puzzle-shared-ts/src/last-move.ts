import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { parseUci } from '@pkgs/chess-rules-shared-ts/uci';

/**
 * The squares chess's board marks for the line's last move (the setup
 * move, the opponent's reply), from its UCI action; null when there is no
 * move to mark.
 */
export function chessPuzzleLastMove(
  action: string | null | undefined
): { readonly from: Square; readonly to: Square } | null {
  if (action === null || action === undefined) return null;
  const move = parseUci(action);
  return move === null
    ? null
    : { from: move.from as Square, to: move.to as Square };
}
