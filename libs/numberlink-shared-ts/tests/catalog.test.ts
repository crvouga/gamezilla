import { expect, test } from 'bun:test';
import {
  numberlinkCatalogSource as catalog,
  numberlinkCatalogPacks,
} from '@libs/numberlink-shared-ts/numberlink-catalog';
import {
  formatNumberlinkNotation,
  type NumberlinkNotation,
  numberlinkAsciiBoard,
  parseNumberlinkNotation,
} from '@libs/numberlink-shared-ts/numberlink-notation';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { assertPuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { z } from 'zod';

const puzzles = numberlinkCatalogPacks.flatMap((pack) => pack.puzzles);
const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Master'];

function notationOf(definition: string): NumberlinkNotation {
  const result = parseNumberlinkNotation(definition);
  if (!result.valid) throw new Error(result.issues[0]?.message);
  return result.value;
}

/** The same board under each of the eight symmetries, relettered, has one key. */
function symmetryKey(notation: NumberlinkNotation): string {
  const keys = Array.from({ length: 8 }, (_, turn) => {
    const swap = turn >= 4;
    const width = swap ? notation.height : notation.width;
    const height = swap ? notation.width : notation.height;
    const move = ({ x, y }: { x: number; y: number }) => {
      const [a, b] = swap ? [y, x] : [x, y];
      return {
        x: turn & 1 ? width - 1 - a : a,
        y: turn & 2 ? height - 1 - b : b,
      };
    };
    const ends = notation.pairs
      .map((pair) =>
        pair.endpoints.map(move).sort((p, q) => p.y - q.y || p.x - q.x)
      )
      .sort((p, q) => p[0]!.y - q[0]!.y || p[0]!.x - q[0]!.x);
    return JSON.stringify([width, height, ends, notation.records]);
  });
  return keys.sort()[0]!;
}

test('the catalog file has one strict shape', () => {
  const entry = z
    .object({
      id: z.string().regex(/^\d{2}$/),
      board: z.string().startsWith('NL1:'),
      solution: z.string().regex(/^[A-Za-z.]+(\/[A-Za-z.]+)+$/),
    })
    .strict();
  const pack = z
    .object({
      id: z.string().regex(/^numberlink-[a-z]+(-[a-z]+)*$/),
      title: z.string().min(1),
      description: z.string().min(1),
      difficulty: z.enum(DIFFICULTIES),
      puzzles: z.array(entry).min(24),
    })
    .strict();
  const file = z
    .object({ format: z.literal(1), packs: z.array(pack) })
    .strict();
  const parsed = file.safeParse(catalog as unknown);
  expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
});

test('at least 512 distinct boards ship in ordered packs with stable ids', () => {
  expect(puzzles.length).toBeGreaterThanOrEqual(512);
  expect(numberlinkCatalogPacks.length).toBeGreaterThanOrEqual(16);
  expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(puzzles.length);
  for (const pack of numberlinkCatalogPacks)
    expect(pack.puzzles.map((puzzle) => puzzle.id)).toEqual(
      pack.puzzles.map(
        (_, index) => `${pack.id}-${String(index + 1).padStart(2, '0')}`
      )
    );
  expect(numberlinkPuzzleContent.bundledPacks).toBe(numberlinkCatalogPacks);
  expect(() =>
    assertPuzzleContent('numberlink', numberlinkPuzzleContent)
  ).not.toThrow();
});

test('every board is the canonical notation of a playable puzzle', () => {
  const unreadable = puzzles.filter(
    (puzzle) =>
      formatNumberlinkNotation(notationOf(puzzle.definition)) !==
        puzzle.definition ||
      !numberlinkPuzzleContent.rules.validateDefinition(puzzle.definition).valid
  );
  expect(unreadable.map((puzzle) => puzzle.id)).toEqual([]);
});

test('no board repeats another under reflection, rotation or relettering', () => {
  const keys = new Map<string, string>();
  const repeats: string[] = [];
  for (const puzzle of puzzles) {
    const key = symmetryKey(notationOf(puzzle.definition));
    const earlier = keys.get(key);
    if (earlier !== undefined) repeats.push(`${earlier} = ${puzzle.id}`);
    keys.set(key, puzzle.id);
  }
  expect(repeats).toEqual([]);
});

test('packs progress from four-square beginner boards to fifteen-square master boards', () => {
  const ranks = numberlinkCatalogPacks.map((pack) =>
    DIFFICULTIES.indexOf(pack.puzzles[0]!.difficulty)
  );
  expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
  expect(ranks[0]).toBe(0);
  expect(ranks.at(-1)).toBe(DIFFICULTIES.length - 1);
  const shapes = puzzles.map((puzzle) => notationOf(puzzle.definition));
  const sizes = new Set(
    shapes.map((shape) => `${shape.width}x${shape.height}`)
  );
  expect(sizes.size).toBeGreaterThanOrEqual(30);
  const areas = numberlinkCatalogPacks.map((pack) =>
    pack.puzzles.map((puzzle) => {
      const shape = notationOf(puzzle.definition);
      return shape.width * shape.height;
    })
  );
  expect(Math.max(...areas[0]!)).toBeLessThanOrEqual(25);
  expect(Math.min(...areas.at(-1)!)).toBe(225);
  expect(
    shapes.filter((shape) => shape.records.length > 0).length
  ).toBeGreaterThanOrEqual(24);
  expect(Math.max(...shapes.map((shape) => shape.pairs.length))).toBeLessThan(
    32
  );
});

test('a shipped entry reads as its ASCII board, solved board and edition', () => {
  const entry = puzzles.find(
    (puzzle) => puzzle.id === 'numberlink-first-threads-09'
  );
  expect(entry).toMatchObject({
    title: 'First threads 9',
    difficulty: 'Beginner',
    description:
      '5 by 5 board with 5 pairs. Join every pair and fill every cell.',
    definition: 'NL1:A3A/1BC1D/1E1C1/1B1E1/D4',
  });
  expect(numberlinkAsciiBoard(notationOf(entry!.definition))).toBe(
    ['A...A', '.BC.D', '.E.C.', '.B.E.', 'D....'].join('\n')
  );
  expect(catalog.packs[0]?.puzzles[8]).toEqual({
    id: '09',
    board: 'NL1:A3A/1BC1D/1E1C1/1B1E1/D4',
    solution: 'AAAAA/BBCCD/BEECD/BBEED/DDDDD',
  });
  expect(entry!.witness.map((action) => JSON.parse(action))).toEqual([
    {
      pairId: 'A',
      cells: [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 })),
    },
    {
      pairId: 'B',
      cells: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 1, y: 3 },
      ],
    },
    {
      pairId: 'C',
      cells: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
    },
    {
      pairId: 'D',
      cells: [
        { x: 4, y: 1 },
        { x: 4, y: 2 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ],
    },
    {
      pairId: 'E',
      cells: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
      ],
    },
  ]);
  // A published edition carries the board, never the solved board.
  expect(JSON.stringify(entry)).not.toContain('AAAAA/BBCCD/BEECD/BBEED/DDDDD');
});
