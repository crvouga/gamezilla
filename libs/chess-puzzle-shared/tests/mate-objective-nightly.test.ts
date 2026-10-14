import { expect, test } from 'bun:test';
import { judgePuzzleMove } from '@libs/chess-puzzle-shared/chess-puzzle-move-judge';
import { Chess } from 'chess.js';

test('two hundred identical ladder positions accept every mate', () => {
  // regression: mate-oracle-rebuilds-every-candidate
  const fen = '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2';
  for (let example = 0; example < 200; example += 1) {
    const oracle = new Chess(fen);
    let mates = 0;
    for (const candidate of oracle.moves({ verbose: true })) {
      oracle.move(candidate);
      const checkmate = oracle.isCheckmate();
      oracle.undo();
      if (!checkmate) continue;
      mates += 1;
      expect(
        judgePuzzleMove({
          fen,
          tokens: ['a2a3', 'b7b8'],
          idx: 1,
          uci: candidate.lan,
        })
      ).toMatchObject({ kind: 'correct', ends: true });
    }
    expect(mates).toBeGreaterThan(1);
  }
});
