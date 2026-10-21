import { describe, expect, test } from 'bun:test';
import {
  type ConnectFour,
  decodeConnectFour,
  dropDisc,
  encodeConnectFour,
  legalColumns,
  newConnectFour,
  replayConnectFour,
} from '@libs/connect-four-shared-ts/connect-four';
import { chooseConnectFourColumn } from '@libs/connect-four-shared-ts/connect-four-bot';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

/** Independent oracle: enumerate every contiguous four-cell window by endpoints. */
function oracle(game: ConnectFour): number[] {
  const winners = new Set<number>();
  for (let a = 0; a < 42; a++)
    for (let b = a + 1; b < 42; b++) {
      const dx = (b % 7) - (a % 7);
      const dy = Math.floor(b / 7) - Math.floor(a / 7);
      if (
        !(
          (Math.abs(dx) === 3 && (dy === 0 || Math.abs(dy) === 3)) ||
          (dx === 0 && dy === 3)
        )
      )
        continue;
      const cells = [a, a + (b - a) / 3, a + (2 * (b - a)) / 3, b];
      if (
        game.board[a] !== 0 &&
        cells.every((i) => game.board[i] === game.board[a])
      )
        for (const i of cells) winners.add(i);
    }
  return [...winners].sort((a, b) => a - b);
}
function check(game: ConnectFour): void {
  expect(game.board).toHaveLength(42);
  const first = game.board.filter((c) => c === 1).length;
  const second = game.board.filter((c) => c === 2).length;
  expect(first - second).toBe(game.moves.length % 2);
  expect(first + second).toBe(game.moves.length);
  expect(game.turn).toBe(game.moves.length % 2 === 0 ? 1 : 2);
  for (let c = 0; c < 7; c++) {
    const column = Array.from({ length: 6 }, (_, r) => game.board[r * 7 + c]);
    const firstEmpty = column.indexOf(0);
    if (firstEmpty >= 0)
      expect(column.slice(firstEmpty).every((v) => v === 0)).toBe(true);
  }
  expect(game.winning).toEqual(oracle(game));
  expect(game.result === 3).toBe(
    game.moves.length === 42 && game.winning.length === 0
  );
  if (game.result === 1 || game.result === 2)
    expect(game.winning.length).toBeGreaterThanOrEqual(4);
  expect(decodeConnectFour(encodeConnectFour(game))).toEqual(game);
  expect(replayConnectFour(game.moves)).toEqual(game);
}
function exerciseTransition(
  game: ConnectFour,
  choice: number,
  untouched: ConnectFour
): ConnectFour {
  check(game);
  const moves = legalColumns(game);
  expect(moves).toEqual(
    game.result === 0
      ? [0, 1, 2, 3, 4, 5, 6].filter((c) => game.board[35 + c] === 0)
      : []
  );
  const before = JSON.stringify(game);
  for (const invalid of [-1, 7, 0.5, NaN, Infinity])
    expect(dropDisc(game, invalid)).toBeNull();
  expect(dropDisc(game, 0, game.turn === 1 ? 2 : 1)).toBeNull();
  const next = dropDisc(game, moves[choice % moves.length] ?? 0);
  if (next !== null) {
    expect(next.moves.length).toBe(game.moves.length + 1);
  } else expect(moves).toHaveLength(0);
  expect(JSON.stringify(untouched)).toBe(JSON.stringify(newConnectFour()));
  if (next === null) expect(JSON.stringify(game)).toBe(before);
  return next ?? game;
}
describe('classic rules integrity', () => {
  test('reachable transitions conserve discs, gravity, history and terminal authority', () => {
    assertProperty(
      'Connect Four reachable states',
      fc.property(
        fc.array(fc.nat(), { minLength: 42, maxLength: 100 }),
        (choices) => {
          let game = newConnectFour();
          const untouched = newConnectFour();
          for (const choice of choices) {
            game = exerciseTransition(game, choice, untouched);
          }
          check(game);
          expect(game.result).not.toBe(0);
          for (let c = 0; c < 7; c++) expect(dropDisc(game, c)).toBeNull();
        }
      )
    );
  });
  test('horizontal reflection preserves every legal transition and result', () => {
    assertProperty(
      'Connect Four reflection',
      fc.property(
        fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 42 }),
        (columns) => {
          let normal = newConnectFour();
          let mirror = newConnectFour();
          for (const c of columns) {
            const a = dropDisc(normal, c);
            const b = dropDisc(mirror, 6 - c);
            expect(a === null).toBe(b === null);
            if (a === null || b === null) continue;
            normal = a;
            mirror = b;
            expect(a.result).toBe(b.result);
            for (let i = 0; i < 42; i++)
              expect(a.board[i]).toBe(
                b.board[Math.floor(i / 7) * 7 + 6 - (i % 7)]
              );
          }
        }
      )
    );
  });
  test('untrusted histories cannot invent cells, versions or moves after completion', () => {
    assertProperty(
      'Connect Four invalid history',
      fc.property(fc.string(), (text) => {
        let decoded: ConnectFour;
        try {
          decoded = decodeConnectFour(text);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          return;
        }
        check(decoded);
      })
    );
    for (const value of ['c4:2:', 'c4:1:7', 'c4:1:0000000', 'c4:1:01010102'])
      expect(() => decodeConnectFour(value)).toThrow();
  });
});
describe('bounded bot decisions', () => {
  test('every difficulty completes legal deterministic games', () => {
    assertProperty(
      'Connect Four bot lifecycle',
      fc.property(
        fc.constantFrom('easy', 'medium', 'hard'),
        fc.integer({ min: 0, max: 99 }),
        (difficulty, pick) => {
          let game = newConnectFour();
          while (game.result === 0) {
            const selected = chooseConnectFourColumn(
              game,
              difficulty,
              () => pick / 100
            );
            expect(selected).not.toBeNull();
            expect(
              chooseConnectFourColumn(game, difficulty, () => pick / 100)
            ).toBe(selected);
            const next = dropDisc(game, selected!);
            expect(next).not.toBeNull();
            game = next!;
          }
          check(game);
          expect(chooseConnectFourColumn(game, difficulty, () => 0)).toBeNull();
        }
      ),
      { numRuns: 6 }
    );
  });
  test('planning takes immediate wins and blocks all single immediate threats', () => {
    assertProperty(
      'Connect Four tactics',
      fc.property(
        fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 36 }),
        (moves) => {
          let game = newConnectFour();
          for (const c of moves) game = dropDisc(game, c) ?? game;
          if (game.result !== 0) return;
          const wins = legalColumns(game).filter(
            (c) => dropDisc(game, c)?.result === game.turn
          );
          for (const difficulty of ['medium', 'hard'] as const) {
            const selected = chooseConnectFourColumn(
              game,
              difficulty,
              () => 0
            )!;
            if (wins.length > 0) expect(wins).toContain(selected);
            else {
              const safe = legalColumns(game).filter((c) => {
                const next = dropDisc(game, c)!;
                return !legalColumns(next).some(
                  (reply) => dropDisc(next, reply)?.result === next.turn
                );
              });
              if (safe.length > 0) expect(safe).toContain(selected);
            }
          }
        }
      )
    );
  });
});
