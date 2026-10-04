import { describe, expect, test } from 'bun:test';
import { parseFen, START_FEN, serializeFen } from '@pkgs/chess-rules-shared/fen';
import { applyUci, legalMoves, perft, uciFromSan } from '@pkgs/chess-rules-shared/moves';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const KIWIPETE =
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
/** Fixed seed: the property runs are deterministic simulations (spec §0.1). */
const SEED = 20260919;

function kingSquare(fen: string, color: 'w' | 'b'): string | null {
  const chess = new Chess(fen);
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell?.type === 'k' && cell.color === color) return cell.square;
    }
  }
  return null;
}

/** Walks `picks` through legal moves, checking invariants at every ply. */
function walk(startFen: string, picks: readonly number[]): void {
  let fen = startFen;
  for (const pick of picks) {
    const moves = legalMoves(fen);
    expect(perft(fen, 1)).toBe(moves.length);
    const parsed = parseFen(fen);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(serializeFen(parsed.fields)).toBe(fen);
    if (moves.length === 0) return;
    const move = moves[pick % moves.length]!;
    expect(uciFromSan(fen, move.san)).toBe(move.uci);
    const mover = parsed.ok ? parsed.fields.sideToMove : 'w';
    const result = applyUci(fen, move.uci);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.san).toBe(move.san);
    // Legality: the side that just moved is never left in check.
    const king = kingSquare(result.fen, mover);
    expect(king).not.toBeNull();
    expect(
      new Chess(result.fen).isAttacked(king as never, mover === 'w' ? 'b' : 'w')
    ).toBe(false);
    fen = result.fen;
  }
}

describe('random legal walks (seeded)', () => {
  for (const [name, start] of [
    ['startpos', START_FEN],
    ['kiwipete', KIWIPETE],
  ] as const) {
    test(`${name}: FEN round-trip, SAN↔UCI round-trip, perft(1) = move count, no self-check`, () => {
      assertProperty(
        `${name}: FEN round-trip, SAN↔UCI round-trip, perft(1) = move count, no self-check`,
        fc.property(
          fc.array(fc.nat(), { minLength: 1, maxLength: 40 }),
          (picks) => {
            walk(start, picks);
          }
        ),
        { seed: SEED, numRuns: 60 }
      );
    }, 120_000);
  }
});
