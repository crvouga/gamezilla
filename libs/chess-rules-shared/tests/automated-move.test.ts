import { expect, test } from 'bun:test';
import { chooseChessMove } from '@libs/chess-rules-shared/automated-move';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const POSITIONS = [
  new Chess().fen(),
  '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
  '7k/P7/8/8/8/8/8/6K1 w - - 0 1',
  '4k3/8/8/2q5/3B4/8/8/4K3 w - - 0 1',
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
  '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2',
] as const;

function verboseChoice(fen: string, random: () => number) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const candidates = new Chess(fen).moves({ verbose: true }).map((move) => ({
    move,
    score:
      (values[move.captured ?? ''] ?? 0) +
      (move.promotion === 'q' ? 8 : 0) +
      (move.san.includes('#') ? 100 : 0) +
      random(),
  }));
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      (a.move.lan < b.move.lan ? -1 : a.move.lan > b.move.lan ? 1 : 0)
  );
  return candidates[0]?.move ?? null;
}

test('scoring SAN preserves chosen moves, snapshots, and random consumption', () => {
  assertProperty(
    'SAN and verbose move choice agree',
    fc.property(fc.constantFrom(...POSITIONS), fc.integer(), (fen, seed) => {
      const first = createHarnessIds(seed).random;
      const second = createHarnessIds(seed).random;
      expect(chooseChessMove(fen, first)).toEqual(verboseChoice(fen, second));
      expect(first()).toBe(second());
    })
  );
});

test.each(POSITIONS)('equal scores preserve LAN ordering in %s', (fen) => {
  expect(chooseChessMove(fen, () => 0.5)).toEqual(
    verboseChoice(fen, () => 0.5)
  );
});
