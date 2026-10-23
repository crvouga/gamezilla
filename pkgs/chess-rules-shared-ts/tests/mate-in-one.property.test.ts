import { expect, test } from 'bun:test';
import { hasMateInOne } from '@pkgs/chess-rules-shared-ts/moves';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { Chess } from 'chess.js';
import fc from 'fast-check';
import { tacticalPosition } from './tactical-positions';

test('mate detection agrees with playing the legal continuations, including promotions', () => {
  assertProperty(
    'mate-in-one preserves canonical chess truth',
    fc.property(
      fc.oneof(
        tacticalPosition,
        fc.constantFrom(
          '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',
          '8/6Pk/5K2/8/8/8/8/8 w - - 0 1',
          '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'
        )
      ),
      (fen) => {
        const oracle = new Chess(fen);
        const expected = oracle.moves({ verbose: true }).some((move) => {
          oracle.move(move);
          const mate = oracle.isCheckmate();
          oracle.undo();
          return mate;
        });
        expect(hasMateInOne(fen)).toBe(expected);
      }
    )
  );
});
