import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import sql from '@pkgs/sql-root-shared/sql';

export type HarnessPuzzleLoad = {
  readonly status: 'ready' | 'adding' | 'finished' | 'failed';
  readonly added: number;
  readonly broken: number;
  readonly error: string | null;
};

type StoredLoad = {
  readonly id: string;
  readonly status: string;
  readonly inserted_rows: number;
  readonly failed_rows: number;
  readonly error: string | null;
};

async function latest(s: ProductHarness): Promise<StoredLoad | undefined> {
  return (
    await s.harness.serverSql.sqlClient.query(sql<StoredLoad>`
      SELECT id, status, inserted_rows, failed_rows, error
      FROM chess_puzzle_load
      WHERE deleted_at IS NULL AND status IS NOT NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `)
  )[0];
}

export async function readHarnessPuzzleLoad(
  s: ProductHarness
): Promise<HarnessPuzzleLoad> {
  const row = await latest(s);
  if (row === undefined) {
    return { status: 'ready', added: 0, broken: 0, error: null };
  }
  if (
    row.status !== 'adding' &&
    row.status !== 'finished' &&
    row.status !== 'failed'
  ) {
    throw new Error(`unexpected puzzle load status ${row.status}`);
  }
  return {
    status: row.status,
    added: row.inserted_rows,
    broken: row.failed_rows,
    error: row.error,
  };
}

export const setHarnessPuzzleLoad = scenarioAction({
  name: 'setHarnessPuzzleLoad',
  act: async (
    s,
    state: Omit<HarnessPuzzleLoad, 'status'> & {
      readonly status: Exclude<HarnessPuzzleLoad['status'], 'ready'>;
    }
  ) => {
    const now = new Date(s.harness.clock.now()).toISOString();
    const current = await latest(s);
    if (current !== undefined) {
      await s.harness.serverSql.sqlClient.run(sql<void>`
        UPDATE chess_puzzle_load
        SET status = ${state.status}, inserted_rows = ${state.added},
            failed_rows = ${state.broken}, error = ${state.error}, updated_at = ${now},
            finished_at = ${state.status === 'adding' ? null : now}
        WHERE id = ${current.id}
      `);
      return;
    }
    await s.harness.serverSql.sqlClient.run(sql<void>`
      INSERT INTO chess_puzzle_load (
        id, created_at, updated_at, source_etag, status, requested_by,
        object_key, processed_rows, inserted_rows, failed_rows, error,
        finished_at
      ) VALUES (
        ${`harness-load-${String(s.harness.clock.now())}`}, ${now}, ${now},
        ${'harness'}, ${state.status}, ${'alice'}, ${'chess/puzzles.ndjson'},
        ${state.added + state.broken}, ${state.added}, ${state.broken}, ${state.error},
        ${state.status === 'adding' ? null : now}
      )
    `);
  },
});

export const addHarnessManagedPuzzles = scenarioAction({
  name: 'addHarnessManagedPuzzles',
  act: async (s) => {
    const now = new Date(s.harness.clock.now()).toISOString();
    const existing = (
      await s.harness.serverSql.sqlClient.query(sql<{ readonly count: number }>`
        SELECT count(*) AS count FROM chess_puzzles
        WHERE id LIKE ${'managed-puzzle-%'}
      `)
    )[0];
    const offset = Number(existing?.count ?? 0);
    for (let index = 1; index <= 3; index += 1) {
      const sequence = offset + index;
      const id = `managed-puzzle-${String(sequence)}`;
      await s.harness.serverSql.sqlClient.run(sql<void>`
        INSERT INTO chess_puzzles (
          id, created_at, updated_at, fen, moves, rating, rating_deviation,
          popularity, nb_plays, themes, game_url, opening_tags, position_key
        ) VALUES (
          ${id}, ${now}, ${now}, ${'8/8/8/8/8/8/8/8 w - - 0 1'},
          ${'a2a3 a7a6'}, ${1200 + sequence}, ${80}, ${50}, ${10}, ${'[]'},
          ${null}, ${'[]'}, ${`managed-position-${String(sequence)}`}
        ) ON CONFLICT DO NOTHING
      `);
    }
  },
});

export async function readHarnessPuzzleCount(
  s: ProductHarness
): Promise<number> {
  const row = (
    await s.harness.serverSql.sqlClient.query(sql<{ readonly count: number }>`
      SELECT count(*) AS count FROM chess_puzzles WHERE deleted_at IS NULL
    `)
  )[0];
  return Number(row?.count ?? 0);
}
