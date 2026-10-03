import type { Names, World } from '@libs/harness/alloy/snapshot-worlds';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

type ResultRow = {
  id: string;
  owner_id: string;
  puzzle_id: string;
  result: string;
};
const RESULT = {
  solved: 'Solved',
  failed: 'Failed',
  abandoned: 'Abandoned',
} as const;

/** Projects persisted progress directly, keeping duplicate rows as distinct atoms. */
export async function projectPuzzleProgress(
  db: SqlTx,
  names: Names
): Promise<World> {
  const played =
    await db.query(sql<ResultRow>`SELECT id, owner_id, puzzle_id, kind AS result
    FROM chess_puzzle_interactions
    WHERE deleted_at IS NULL AND kind IN ('solved', 'failed', 'abandoned')`);
  const rated =
    await db.query(sql<ResultRow>`SELECT id, owner_id, puzzle_id, outcome AS result
    FROM chess_puzzle_rating_events WHERE deleted_at IS NULL`);
  const rows = [...played, ...rated];
  const solvers = [
    ...new Set(rows.map((row) => `solver ${names(row.owner_id)}`)),
  ].sort();
  const puzzles = [
    ...new Set(rows.map((row) => `puzzle ${row.puzzle_id}`)),
  ].sort();
  const atoms = {
    Solver: solvers,
    Puzzle: puzzles,
    Solved: ['solved'],
    Failed: ['failed'],
    Abandoned: ['abandoned'],
    PlayedPuzzle: played.map((row) => `played ${row.id}`),
    RatedPuzzle: rated.map((row) => `rated ${row.id}`),
  };
  function relations(
    data: readonly ResultRow[],
    type: 'PlayedPuzzle' | 'RatedPuzzle'
  ) {
    const prefix = type === 'PlayedPuzzle' ? 'played' : 'rated';
    return {
      [`${type}.solver`]: data.map((row) => [
        `${prefix} ${row.id}`,
        `solver ${names(row.owner_id)}`,
      ]),
      [`${type}.puzzle`]: data.map((row) => [
        `${prefix} ${row.id}`,
        `puzzle ${row.puzzle_id}`,
      ]),
      [`${type}.result`]: data.map((row) => {
        if (!(row.result in RESULT))
          throw new Error(`Unknown puzzle result: ${row.result}`);
        return [`${prefix} ${row.id}`, row.result];
      }),
    };
  }
  return {
    atoms,
    relations: {
      ...relations(played, 'PlayedPuzzle'),
      ...relations(rated, 'RatedPuzzle'),
    },
  };
}
