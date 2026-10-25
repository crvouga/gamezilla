import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  BOARD_SIZE,
  bonusSquareAt,
  CELL_COUNT,
  CENTER_CELL,
} from '../src/word-tiles-board';
import { evaluatePlacement } from '../src/word-tiles-placement';
import { RULESET } from '../src/word-tiles-ruleset';
import { letterPoints } from '../src/word-tiles-tiles';

type Placed = {
  readonly cell: number;
  readonly letter: string;
  readonly blank: boolean;
};

const rowOf = (cell: number) => Math.floor(cell / BOARD_SIZE);
const columnOf = (cell: number) => cell % BOARD_SIZE;

/** The letter shown at a row and column of `cells`, `.` off the board. */
function shownAt(cells: readonly string[], row: number, column: number) {
  const outside =
    row < 0 || column < 0 || row >= BOARD_SIZE || column >= BOARD_SIZE;
  return outside ? '.' : cells[row * BOARD_SIZE + column]!;
}

/** Whether the new tiles lie in one line with no gap once they are down. */
function inOneLine(next: readonly string[], cells: readonly number[]) {
  const rows = new Set(cells.map(rowOf));
  const columns = new Set(cells.map(columnOf));
  if (rows.size > 1 && columns.size > 1) return false;
  const sorted = [...cells].sort((a, b) => a - b);
  const step = rows.size === 1 ? 1 : BOARD_SIZE;
  for (let cell = sorted[0]!; cell <= sorted.at(-1)!; cell += step)
    if (next[cell] === '.') return false;
  return true;
}

/** Whether a new tile has an old tile beside it. */
function touchesBoard(board: string, cells: ReadonlySet<number>) {
  const old = [...board];
  return [...cells].some((cell) =>
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(
      ([dr, dc]) =>
        shownAt(old, rowOf(cell) + dr!, columnOf(cell) + dc!) !== '.'
    )
  );
}

function accepted(board: string, placed: readonly Placed[]): boolean {
  const cells = new Set(placed.map((p) => p.cell));
  if (placed.length === 0 || cells.size !== placed.length) return false;
  if (placed.some((p) => board[p.cell] !== '.')) return false;
  if (!inOneLine(withTiles(board, placed), [...cells])) return false;
  if (/^\.+$/.test(board)) return cells.has(CENTER_CELL) && placed.length >= 2;
  return touchesBoard(board, cells);
}

function withTiles(board: string, placed: readonly Placed[]): string[] {
  const next = [...board];
  for (const p of placed)
    next[p.cell] = p.blank ? p.letter.toLowerCase() : p.letter;
  return next;
}

const LETTER_TIMES: Readonly<Record<string, number>> = { DL: 2, TL: 3 };
const WORD_TIMES: Readonly<Record<string, number>> = { DW: 2, TW: 3 };

/** The run starting at a row and column going (dr, dc), scored. */
function scoredRun(
  next: readonly string[],
  start: readonly [number, number],
  step: readonly [number, number],
  fresh: ReadonlySet<number>
) {
  let word = '';
  let letters = 0;
  let multiplier = 1;
  let touched = false;
  for (
    let [r, c] = start;
    shownAt(next, r, c) !== '.';
    r += step[0], c += step[1]
  ) {
    const shown = shownAt(next, r, c);
    const cell = r * BOARD_SIZE + c;
    const square = fresh.has(cell) ? (bonusSquareAt(cell) ?? '') : '';
    touched ||= fresh.has(cell);
    const value = shown === shown.toUpperCase() ? letterPoints(shown) : 0;
    letters += value * (LETTER_TIMES[square] ?? 1);
    multiplier *= WORD_TIMES[square] ?? 1;
    word += shown.toUpperCase();
  }
  return touched && word.length >= 2
    ? { word, points: letters * multiplier }
    : null;
}

/** Every maximal run of two or more letters holding a new tile, scored. */
function runs(next: readonly string[], fresh: ReadonlySet<number>) {
  const words: { word: string; points: number }[] = [];
  for (const step of [
    [0, 1],
    [1, 0],
  ] as const)
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const [row, column] = [rowOf(cell), columnOf(cell)];
      const starts =
        shownAt(next, row, column) !== '.' &&
        shownAt(next, row - step[0], column - step[1]) === '.';
      const run = starts ? scoredRun(next, [row, column], step, fresh) : null;
      if (run !== null) words.push(run);
    }
  return words;
}

/**
 * An independent, deliberately naive scorer: it shares no code with the
 * game's placement module but the bonus layout and letter values (data).
 * A placement is accepted when it covers empty squares of one line with
 * no gap, covers the centre on an empty board (two tiles at least) and
 * otherwise touches the board; it forms every maximal run of two or more
 * letters that holds a new tile.
 */
function reference(board: string, placed: readonly Placed[]) {
  if (!accepted(board, placed)) return null;
  const words = runs(
    withTiles(board, placed),
    new Set(placed.map((p) => p.cell))
  );
  if (words.length === 0) return null;
  const bonus = placed.length === RULESET.rackSize ? RULESET.sevenTileBonus : 0;
  return {
    total: words.reduce((sum, w) => sum + w.points, 0) + bonus,
    words: words.map((w) => w.word).sort(),
  };
}

const LETTER = fc.constantFrom(...'AEIOUSTRNLCDMQZ');

/** Some letters near the centre, or nothing. */
const BOARD = fc.oneof(
  { weight: 1, arbitrary: fc.constant('.'.repeat(CELL_COUNT)) },
  {
    weight: 4,
    arbitrary: fc
      .array(
        fc.record({
          row: fc.integer({ min: 4, max: 10 }),
          column: fc.integer({ min: 4, max: 10 }),
          letter: LETTER,
          blank: fc.boolean(),
        }),
        { minLength: 1, maxLength: 20 }
      )
      .map((tiles) => {
        const cells = [...'.'.repeat(CELL_COUNT)];
        for (const t of tiles)
          cells[t.row * BOARD_SIZE + t.column] = t.blank
            ? t.letter.toLowerCase()
            : t.letter;
        return cells.join('');
      }),
  }
);

const TILE = fc.record({ letter: LETTER, blank: fc.boolean() });

/**
 * A span along one line whose empty squares take new tiles — mostly a
 * placement the rules accept — or tiles scattered anywhere (some repeat a
 * square), mostly refused.
 */
function placements(board: string): fc.Arbitrary<readonly Placed[]> {
  const span = fc
    .record({
      across: fc.boolean(),
      line: fc.oneof(fc.constant(7), fc.integer({ min: 3, max: 11 })),
      start: fc.integer({ min: 1, max: 9 }),
      length: fc.integer({ min: 1, max: 10 }),
      tiles: fc.array(TILE, { minLength: 15, maxLength: 15 }),
    })
    .map(({ across, line, start, length, tiles }) => {
      const cells: number[] = [];
      for (let at = start; at < Math.min(BOARD_SIZE, start + length); at++)
        cells.push(across ? line * BOARD_SIZE + at : at * BOARD_SIZE + line);
      return cells
        .filter((cell) => board[cell] === '.')
        .slice(0, RULESET.rackSize)
        .map((cell, at) => ({ cell, ...tiles[at]! }));
    });
  const scattered = fc
    .array(
      fc.record({
        cell: fc.integer({ min: 0, max: CELL_COUNT - 1 }),
        tile: TILE,
      }),
      { minLength: 1, maxLength: 7 }
    )
    .map((tiles) => tiles.map(({ cell, tile }) => ({ cell, ...tile })));
  return fc.oneof(
    { weight: 4, arbitrary: span },
    { weight: 1, arbitrary: scattered }
  );
}

describe('scoring against an independent reference', () => {
  test('the game and the reference accept the same placements and score them alike', () =>
    assertProperty(
      'placements agree with the reference scorer',
      fc.property(
        BOARD.chain((board) =>
          placements(board).map((placed) => [board, placed] as const)
        ),
        ([board, placed]) => {
          const expected = reference(board, placed);
          const evaluation = evaluatePlacement(board, placed);
          expect(
            evaluation.ok
              ? {
                  total: evaluation.score.total,
                  words: evaluation.score.words.map((w) => w.word).sort(),
                }
              : null
          ).toEqual(expected);
        }
      ),
      { numRuns: 3000 }
    ));
});
