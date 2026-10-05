import { expect, test } from 'bun:test';
import { CHESS_TABLES } from '@libs/chess-feature-shared/chess-tables';
import {
  PuzzleLoadAlreadyRunningError,
  PuzzleLoadJobService,
} from '@libs/chess-puzzle-server/puzzle-load-job';
import { CHESS_PUZZLE_OBJECT_KEY } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import sql from '@pkgs/sql-root-shared/sql';
import { openConcurrentPostgres } from './concurrent-postgres';

const AT = Date.parse('2026-10-04T12:00:00.000Z');

function row(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'puzzle-one',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'a2a3 a7a6',
    rating: 1200,
    rating_deviation: 80,
    popularity: 50,
    nb_plays: 12,
    themes: ['endgame'],
    game_url: null,
    opening_tags: [],
    position_key: 'position-one',
    ...overrides,
  });
}

// regression: deploy-empty-chess-puzzle-catalog — a rebuilt environment starts
// empty and must be able to load its required puzzle catalog from object storage.
test('Postgres owns puzzle object normalization, rejection, and deduplication', async () => {
  await using postgres = await openConcurrentPostgres('pool');
  await reconcilePostgresSchema(
    postgres.admin,
    registerTables([...CHESS_TABLES]),
    postgres.dbScope
  );
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(
    store,
    CHESS_PUZZLE_OBJECT_KEY,
    [
      row(),
      row({ id: 'duplicate-position' }),
      row({ id: 'rejected', rating: 'not-a-number' }),
    ].join('\n'),
    'application/x-ndjson'
  );
  let id = 0;
  const service = new PuzzleLoadJobService(
    postgres.db,
    store,
    { now: () => AT },
    () => `load-${++id}`
  );
  const job = await service.run('manager-one');
  expect(job).toMatchObject({
    status: 'finished',
    processedRows: 3,
    insertedRows: 1,
    failedRows: 1,
    error: null,
  });
  const puzzles = await postgres.db.query(sql<{ id: string }>`
    SELECT id FROM chess_puzzles ORDER BY id
  `);
  expect(puzzles).toEqual([{ id: 'puzzle-one' }]);

  const second = await service.run('manager-one');
  expect(second).toMatchObject({
    status: 'finished',
    processedRows: 3,
    insertedRows: 0,
    failedRows: 1,
  });
}, 30_000);

test('refuses a second environment load while one is active', async () => {
  await using postgres = await openConcurrentPostgres('pool');
  await reconcilePostgresSchema(
    postgres.admin,
    registerTables([...CHESS_TABLES]),
    postgres.dbScope
  );
  await postgres.db.run(sql<void>`
    INSERT INTO chess_puzzle_load (
      id, created_at, updated_at, source_etag, status, requested_by,
      object_key, processed_rows, inserted_rows, failed_rows
    ) VALUES (
      ${'active'}, ${'2026-10-04T11:00:00.000Z'},
      ${'2026-10-04T11:00:00.000Z'}, ${''}, ${'adding'}, ${'manager-one'},
      ${CHESS_PUZZLE_OBJECT_KEY}, ${0}, ${0}, ${0}
    )
  `);
  const service = new PuzzleLoadJobService(
    postgres.db,
    new ObjectStoreImplInMemory(),
    { now: () => AT },
    () => 'load-two'
  );
  await expect(service.run('manager-two')).rejects.toBeInstanceOf(
    PuzzleLoadAlreadyRunningError
  );
}, 30_000);
