import { Chess, type Square } from 'chess.js';
import fc from 'fast-check';

const cell = fc.record({
  square: fc.integer({ min: 1, max: 62 }),
  type: fc.constantFrom('q', 'r', 'b', 'n', 'p'),
  color: fc.constantFrom('w', 'b'),
});

/** Independent sparse boards, including checks, pins and shared defenders. */
export const tacticalPosition = fc
  .tuple(
    fc.uniqueArray(cell, {
      minLength: 2,
      maxLength: 10,
      selector: (p) => p.square,
    }),
    fc.constantFrom('w', 'b')
  )
  .map(([pieces, turn]) => {
    const oracle = new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1');
    for (const piece of pieces) {
      const file = piece.square % 8;
      const rank = Math.floor(piece.square / 8) + 1;
      if (piece.type === 'p' && (rank === 1 || rank === 8)) continue;
      oracle.put(
        { type: piece.type, color: piece.color },
        `${'abcdefgh'[file]}${rank}` as Square
      );
    }
    const fields = oracle.fen().split(' ');
    fields[1] = turn;
    return fields.join(' ');
  })
  .filter((fen) => {
    const oracle = new Chess(fen);
    const opponent = oracle.turn() === 'w' ? 'b' : 'w';
    const king = opponent === 'w' ? 'a1' : 'h8';
    return !oracle.isAttacked(king, oracle.turn());
  });
