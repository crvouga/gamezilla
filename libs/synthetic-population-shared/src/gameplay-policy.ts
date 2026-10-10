import type { Random } from '@pkgs/uuid-shared/create-id';
import { Chess, type Move } from 'chess.js';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Cheap legal-move policy; the application still validates every chosen move. */
export function chooseChessMove(fen: string, random: Random): Move | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  const scored = moves.map((move) => ({
    move,
    score:
      (VALUE[move.captured ?? ''] ?? 0) +
      (move.promotion === 'q' ? 8 : 0) +
      (move.san.includes('#') ? 100 : 0) +
      random(),
  }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.move.lan < b.move.lan ? -1 : a.move.lan > b.move.lan ? 1 : 0)
  );
  return scored[0]?.move ?? null;
}
