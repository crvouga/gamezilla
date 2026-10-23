import { expect, test } from 'bun:test';
import { chooseChessMove } from '@libs/chess-rules-shared-ts/automated-move';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const legalChessDecision = fc.property(
  fc.integer(),
  fc.integer({ min: 1, max: 12 }),
  (seed, plies) => {
    const random = createHarnessIds(seed).random;
    const chess = new Chess();
    for (let index = 0; index < plies && !chess.isGameOver(); index += 1) {
      const move = chooseChessMove(chess.fen(), random);
      expect(move).not.toBeNull();
      expect(chess.move(move!).lan).toBe(move!.lan);
    }
  }
);

test('gameplay policy returns legal moves through progressively reached positions', () => {
  assertProperty('legal chess decision', legalChessDecision);
});

test('the nightly gameplay seed finishes within the property budget', () => {
  // regression: gameplay-policy-nightly-seed-cost
  // regression: gameplay-policy-verbose-enumeration-cost
  assertProperty('nightly legal chess decision', legalChessDecision, {
    seed: 629_884_306,
    numRuns: 200,
  });
});
