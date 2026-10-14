import type { Random } from '@pkgs/uuid-shared/create-id';
import { Chess, type Move, type Square } from 'chess.js';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function captureValue(game: Chess, san: string): number {
  if (!san.includes('x')) return 0;
  const target = /[a-h][1-8](?==|[+#]|$)/.exec(san)?.[0];
  if (target === undefined) throw new Error(`Invalid capture: ${san}`);
  // An en-passant capture lands on an empty square and captures a pawn.
  return VALUE[game.get(target as Square)?.type ?? 'p'] ?? 0;
}

/** Cheap legal-move policy; the application still validates every chosen move. */
export function chooseChessMove(fen: string, random: Random): Move | null {
  const game = new Chess(fen);
  // Verbose enumeration computes every candidate's before/after position and
  // regenerates legal moves. Only the selected move needs those snapshots.
  const moves = game.moves();
  if (moves.length === 0) return null;
  const scored = moves.map((san) => ({
    san,
    score:
      captureValue(game, san) +
      (san.includes('=Q') ? 8 : 0) +
      (san.includes('#') ? 100 : 0) +
      random(),
  }));
  const best = Math.max(...scored.map((candidate) => candidate.score));
  const finalists = scored
    .filter((candidate) => candidate.score === best)
    .map((candidate) => {
      const move = game.move(candidate.san);
      game.undo();
      return move;
    });
  finalists.sort((a, b) => (a.lan < b.lan ? -1 : a.lan > b.lan ? 1 : 0));
  return finalists[0] ?? null;
}
