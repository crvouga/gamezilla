import { describe, expect, test } from 'bun:test';
import type { PlacedLetter } from '@libs/word-tiles-shared-ts/word-tiles-action';
import {
  BOARD_SIZE,
  CELL_COUNT,
} from '@libs/word-tiles-shared-ts/word-tiles-board';
import { encodeFrontCoded } from '@libs/word-tiles-shared-ts/word-tiles-lexicon-codec';
import { generateMoves } from '@libs/word-tiles-shared-ts/word-tiles-moves';
import {
  evaluatePlacement,
  unknownWords,
} from '@libs/word-tiles-shared-ts/word-tiles-placement';
import { EMPTY_BOARD } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { BLANK, tileOf } from '@libs/word-tiles-shared-ts/word-tiles-tiles';
import {
  buildWordTrie,
  trieHas,
} from '@libs/word-tiles-shared-ts/word-tiles-trie';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { boardWith, idsOf, lexicon } from './word-tiles-fixtures';

/**
 * The generator against a simple, independent exhaustive reference: every
 * set of up to three empty cells in one row or column, every ordering of
 * the rack's tiles on them, every letter a blank may play, kept when the
 * placement's geometry holds and every word it forms is in a small fixture
 * dictionary. Small racks keep the reference exhaustive; the production
 * search is bounded and makes no optimality claim beyond this.
 */
const FIXTURE_WORDS = [
  'act',
  'acts',
  'ate',
  'cat',
  'cats',
  'east',
  'eat',
  'eats',
  'eta',
  'sat',
  'sea',
  'seat',
  'set',
  'tae',
  'tas',
  'tea',
  'teas',
  'test',
  'ta',
  'at',
  'as',
  'es',
  'et',
].sort();
const TRIE = buildWordTrie(encodeFrontCoded(FIXTURE_WORDS));
const ALPHABET = ['A', 'C', 'E', 'S', 'T'];

function key(placed: readonly PlacedLetter[]): string {
  return placed
    .map((p) => `${p.cell}${p.blank ? p.letter.toLowerCase() : p.letter}`)
    .sort()
    .join('.');
}

function lineSubsets(board: string, size: number): number[][] {
  const subsets: number[][] = [];
  for (const across of [true, false])
    for (let line = 0; line < BOARD_SIZE; line++) {
      const empty = Array.from({ length: BOARD_SIZE }, (_, i) =>
        across ? line * BOARD_SIZE + i : i * BOARD_SIZE + line
      ).filter((cell) => board[cell] === '.');
      const choose = (from: number, picked: number[]) => {
        if (picked.length === size) {
          subsets.push([...picked]);
          return;
        }
        for (let i = from; i < empty.length; i++)
          choose(i + 1, [...picked, empty[i]!]);
      };
      // A single tile lies on both lines through it; take it once.
      if (size > 1 || across) choose(0, []);
    }
  return subsets;
}

function letterings(
  rack: readonly number[],
  count: number
): PlacedLetter[][][] {
  const out: PlacedLetter[][][] = [];
  const pick = (left: readonly number[], chosen: number[]) => {
    if (chosen.length === count) {
      out.push(
        chosen.map((id) => {
          const symbol = tileOf(id)!.symbol;
          return symbol === BLANK
            ? ALPHABET.map((letter) => ({ cell: -1, letter, blank: true }))
            : [{ cell: -1, letter: symbol, blank: false }];
        })
      );
      return;
    }
    left.forEach((id, i) =>
      pick([...left.slice(0, i), ...left.slice(i + 1)], [...chosen, id])
    );
  };
  pick(rack, []);
  return out;
}

function product<T>(choices: readonly (readonly T[])[]): T[][] {
  return choices.reduce<T[][]>(
    (acc, options) =>
      acc.flatMap((prefix) => options.map((o) => [...prefix, o])),
    [[]]
  );
}

function legalIn(board: string, placed: readonly PlacedLetter[]): boolean {
  const evaluation = evaluatePlacement(board, placed);
  return (
    evaluation.ok &&
    unknownWords(evaluation.score, (w) => trieHas(TRIE, w)).length === 0
  );
}

const legalCellSets = new Map<string, number[][]>();

function shapesFor(board: string, size: number): number[][] {
  const cacheKey = `${board}:${size}`;
  const cached = legalCellSets.get(cacheKey);
  if (cached !== undefined) return cached;
  // Geometry depends on the board and cell count, never on the rack.
  const shapes = lineSubsets(board, size).filter(
    (cells) =>
      evaluatePlacement(
        board,
        cells.map((cell) => ({ cell, letter: 'A', blank: false }))
      ).ok
  );
  legalCellSets.set(cacheKey, shapes);
  return shapes;
}

function reference(board: string, rack: readonly number[]): Set<string> {
  const found = new Set<string>();
  for (let size = 1; size <= rack.length; size++) {
    const permutations = letterings(rack, size).flatMap(product);
    for (const cells of shapesFor(board, size)) {
      for (const letters of permutations) {
        const placed = letters.map((l, i) => ({
          ...l,
          cell: cells[i] ?? -1,
        }));
        if (legalIn(board, placed)) found.add(key(placed));
      }
    }
  }
  return found;
}

const BOARDS = [
  EMPTY_BOARD,
  boardWith([['g8', 'across', 'CAT']]),
  boardWith([
    ['g8', 'across', 'CAT'],
    ['i8', 'down', 'TEA'],
  ]),
  boardWith([['a1', 'across', 'SEAT']]),
];

describe('move generation', () => {
  // regression: word-tiles-reference-repeated-geometry
  test('finds exactly the reference placements on small racks', () => {
    assertProperty(
      'generator agrees with the exhaustive reference',
      fc.property(
        fc.constantFrom(...BOARDS),
        fc.array(fc.constantFrom('A', 'C', 'E', 'S', 'T', BLANK), {
          minLength: 1,
          maxLength: 3,
        }),
        (board, letters) => {
          const rack = idsOf(letters.join(''), new Set());
          const generated = generateMoves({
            board,
            rack,
            trie: TRIE,
            budget: 1e7,
          });
          expect(generated.complete).toBe(true);
          const keys = new Set(generated.moves.map((m) => key(m.placed)));
          expect([...keys].sort()).toEqual([...reference(board, rack)].sort());
        }
      ),
      { numRuns: 30 }
    );
  });

  test('a duplicate letter is one placement, whichever tile plays it', () => {
    const rack = idsOf('AAT', new Set());
    const moves = generateMoves({
      board: EMPTY_BOARD,
      rack,
      trie: TRIE,
      budget: 1e7,
    });
    const keys = moves.moves.map((m) => key(m.placed));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('a budget bounds the search and says so', () => {
    const rack = idsOf('ACEST??', new Set());
    const bounded = generateMoves({
      board: EMPTY_BOARD,
      rack,
      trie: TRIE,
      budget: 50,
    });
    expect(bounded.complete).toBe(false);
  });

  test('production search stays inside its budget on a full rack', async () => {
    const words = await lexicon();
    const board = boardWith([
      ['d8', 'across', 'QUOTED'],
      ['g5', 'down', 'BRAT'],
    ]);
    const rack = idsOf('RETAIN?', new Set());
    const search = generateMoves({
      board,
      rack,
      trie: words.trie,
      budget: 200_000,
    });
    expect(search.moves.length).toBeGreaterThan(100);
    for (const move of search.moves.slice(0, 200)) {
      const evaluation = evaluatePlacement(board, move.placed);
      expect(
        evaluation.ok && unknownWords(evaluation.score, words.has)
      ).toEqual([]);
    }
    expect(board.length).toBe(CELL_COUNT);
  });
});
