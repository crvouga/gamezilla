import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared/sub';
/**
 * Stock the puzzle pool with puzzles a scenario describes by what matters to
 * it — rating, popularity, times played, themes — through the real load-file
 * seeder. Positions come from a bank of distinct, valid puzzles, so the
 * seeder's position dedupe never drops a stocked puzzle.
 */

import { scenarioAction } from '@libs/harness/actor-ui';
import { writeServerFixture } from '@libs/harness/write-server-fixture';
import sql from '@pkgs/sql-root-shared/sql';
import { ingestChessPuzzleCsv } from './chess-puzzle-data';
import { POSITION_BANK_CSV } from './puzzle-fixtures';

export type StockedPuzzle = {
  readonly rating: number;
  readonly popularity: number;
  readonly plays: number;
  readonly themes: readonly string[];
};

/** Above the quality bar, with no theme any named puzzle carries. */
export const GOOD_PUZZLE: Omit<StockedPuzzle, 'rating'> = {
  popularity: 90,
  plays: 300,
  themes: ['middlegame'],
};

const HEADER =
  'id,fen,moves,rating,rating_deviation,popularity,nb_plays,themes,game_url,opening_tags';

/** `[fen, moves]` of every bank puzzle, in file order. */
const POSITIONS: readonly (readonly [string, string])[] =
  POSITION_BANK_CSV.split('\n')
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [, fen = '', moves = ''] = line.split(',');
      return [fen, moves] as const;
    });

/** The id the `index`-th stocked puzzle of a scenario gets. */
export function stockedPuzzleId(index: number): string {
  return `stk${String(index + 1).padStart(2, '0')}`;
}

function stockedLine(puzzle: StockedPuzzle, index: number): string {
  const position = POSITIONS[index];
  if (position === undefined) {
    throw new Error(`the position bank holds only ${POSITIONS.length} puzzles`);
  }
  const themes = JSON.stringify(puzzle.themes).replaceAll('"', '""');
  return [
    stockedPuzzleId(index),
    position[0],
    position[1],
    String(puzzle.rating),
    '75',
    String(puzzle.popularity),
    String(puzzle.plays),
    `"${themes}"`,
    '',
    '[]',
  ].join(',');
}

/**
 * Add `puzzles` to the pool in order, as {@link stockedPuzzleId} of
 * `firstIndex`, `firstIndex + 1`, … (a scenario stocking twice continues the
 * count, so ids and positions stay distinct).
 */
export const stockPuzzles = scenarioAction({
  name: 'stockPuzzles',
  act: async (s, puzzles: readonly StockedPuzzle[], firstIndex: number) => {
    const lines = puzzles.map((puzzle, i) =>
      stockedLine(puzzle, firstIndex + i)
    );
    await Promise.resolve(
      ingestChessPuzzleCsv.act(s, [HEADER, ...lines].join('\n'))
    );
  },
});

/** Retire every puzzle in the pool, so only what a scenario stocks is served. */
export const retireEveryPuzzle = scenarioAction({
  name: 'retireEveryPuzzle',
  act: async (s) => {
    await writeServerFixture(s, GAME_PUZZLE_SUB.topicMap, async (db) => {
      await db.run(sql`
      UPDATE chess_puzzles
      SET deleted_at = ${new Date(s.harness.clock.now()).toISOString()}
      WHERE deleted_at IS NULL
      `);
    });
  },
});
