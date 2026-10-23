import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { InitializePuzzleCatalog } from '@libs/chess-puzzle-server-ts/initialize-puzzle-catalog';
import { chessPackageRootFromLoadFileModule } from '@libs/chess-puzzle-server-ts/load-file';
import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from '@libs/chess-puzzle-server-ts/load-file-constants';
import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared-ts/sub';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared-ts/in-memory';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { runQuery } from '@pkgs/sync-engine-server-ts/run-query';
import { syncEngineTopicSeq } from '@pkgs/sync-engine-shared-ts/tables';

async function openCatalog(csv: string) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([...GAME_PUZZLE_SUB.tables, syncEngineTopicSeq]),
    { ownership: 'declared-only' }
  );
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(store, CHESS_PUZZLES_LOAD_FILE_RELATIVE, csv);
  const clock = { now: () => 1_700_000_000_000 };
  const logger = createLogger({
    name: 'test',
    level: 'silent',
    now: clock.now,
  });
  const pubsub = createInMemoryPubSub({ logger });
  const pushes: unknown[] = [];
  pubsub.subscribe(puzzleCatalogueTopic(), (push) => pushes.push(push));
  let id = 0;
  const initialize = new InitializePuzzleCatalog(db, {
    loadFileStore: store,
    clock,
    createId: () => `catalog-${id++}`,
    logger,
    pubsub,
  });
  return {
    db,
    store,
    initialize,
    pushes,
    close: async () => {
      pubsub.close();
      await db.disconnect();
    },
  };
}

// regression: deploy-unseeded-chess-puzzle-catalog
// Production returned zero rows for each fresh device band: 800–1199,
// 1200–1599 and 1600–1999, after the schema pass had created an empty table.
test('an empty deployed catalog serves puzzles at the seed rating and wakes devices', async () => {
  const csv = await Bun.file(
    join(chessPackageRootFromLoadFileModule(), CHESS_PUZZLES_LOAD_FILE_RELATIVE)
  ).text();
  const catalog = await openCatalog(csv);
  try {
    const summary = await catalog.initialize.run();
    expect(summary?.rowsInserted).toBeGreaterThan(0);
    for (const ratingMin of [800, 1200, 1600]) {
      const response = await runQuery(
        {
          db: catalog.db,
          registry: Object.fromEntries(
            GAME_PUZZLE_SUB.queries.map((query) => [query.name, query])
          ),
          auth: {
            actorId: '5e7e71c0-0000-4000-8000-00000000c0de',
            accountId: '5e7e71c0-0000-4000-8000-00000000c0de',
            deviceId: 'device',
            isAnon: false,
            now: () => new Date(1_700_000_000_000),
          },
          nextCheckpoint: () => '1',
        },
        {
          name: 'chessPuzzlePool',
          params: { ratingMin, ratingMax: ratingMin + 399 },
        }
      );
      expect(response.status).toBe('ok');
      if (response.status !== 'ok') throw new Error('pool query failed');
      expect(response.tables['chess_puzzles']!.length).toBeGreaterThan(0);
    }
    expect(catalog.pushes).toEqual([
      { pushSeq: '1', tables: ['chess_puzzles'] },
    ]);
    const before = await catalog.db.query(
      sql<Record<string, unknown>>`SELECT * FROM chess_puzzles ORDER BY id`
    );
    await catalog.store.delete(CHESS_PUZZLES_LOAD_FILE_RELATIVE);
    expect(await catalog.initialize.run()).toBeNull();
    expect(
      await catalog.db.query(
        sql<Record<string, unknown>>`SELECT * FROM chess_puzzles ORDER BY id`
      )
    ).toEqual(before);
    expect(catalog.pushes).toHaveLength(1);
  } finally {
    await catalog.close();
  }
});

// regression: deploy-unseeded-chess-puzzle-catalog
test('initialization preserves a deliberately removed catalog', async () => {
  const catalog = await openCatalog('');
  try {
    await catalog.db.run(sql`
      INSERT INTO chess_puzzles (id, created_at, updated_at, deleted_at)
      VALUES ('removed', '2026-10-05T07:25:00Z', '2026-10-05T07:25:00Z', '2026-10-05T07:25:00Z')
    `);
    expect(await catalog.initialize.run()).toBeNull();
    expect(catalog.pushes).toEqual([]);
  } finally {
    await catalog.close();
  }
});

// regression: deploy-unseeded-chess-puzzle-catalog
test('an unusable initial catalog fails deployment instead of leaving an empty pool', async () => {
  const catalog = await openCatalog('id,fen,moves\nbroken,invalid,e2e4');
  try {
    await expect(catalog.initialize.run()).rejects.toThrow('no valid puzzles');
    expect(catalog.pushes).toEqual([]);
  } finally {
    await catalog.close();
  }
});
