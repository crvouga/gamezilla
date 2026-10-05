import { expect, test } from 'bun:test';
import { InitializePuzzleCatalog } from '@libs/chess-puzzle-server/initialize-puzzle-catalog';
import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from '@libs/chess-puzzle-server/load-file-constants';
import { chessPuzzles } from '@libs/chess-puzzle-shared/puzzle-tables';
import { chessPuzzlesTopic } from '@libs/chess-root-shared/sync-topics';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createLogger } from '@pkgs/logger-shared/logger';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared/in-memory';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { syncEngineTopicSeq } from '@pkgs/sync-engine-shared/tables';
import fc from 'fast-check';

async function openCatalog(csv: string) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([chessPuzzles, syncEngineTopicSeq]),
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
  pubsub.subscribe(chessPuzzlesTopic(), (push) => pushes.push(push));
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
const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';

function csv(id: string, rating: number): string {
  return `${HEADER}\n${id},${FEN},d2c3 d4g1,${rating},112,100,43,mate mateIn1,,`;
}

const input = fc.record({
  id: fc.uuid(),
  rating: fc.integer({ min: 400, max: 3000 }),
  removed: fc.boolean(),
  deployments: fc.integer({ min: 1, max: 5 }),
});

test('deploying changed reference data preserves initialized catalogs and removals', async () => {
  await assertProperty(
    'deploying changed reference data preserves initialized catalogs and removals',
    fc.asyncProperty(input, async ({ id, rating, removed, deployments }) => {
      const catalog = await openCatalog(csv(id, rating));
      try {
        expect((await catalog.initialize.run())?.rowsInserted).toBe(1);
        if (removed) {
          await catalog.db.run(sql`
            UPDATE chess_puzzles SET deleted_at = '2026-10-05T07:25:00Z'
            WHERE id = ${id}
          `);
        }
        const rows = () =>
          catalog.db.query(
            sql<
              Record<string, unknown>
            >`SELECT * FROM chess_puzzles ORDER BY id`
          );
        const before = await rows();
        for (let deployment = 0; deployment < deployments; deployment++) {
          await writeUtf8(
            catalog.store,
            CHESS_PUZZLES_LOAD_FILE_RELATIVE,
            csv(`${id}-changed-${deployment}`, rating + 1)
          );
          expect(await catalog.initialize.run()).toBeNull();
          expect(await rows()).toEqual(before);
        }
        expect(catalog.pushes).toHaveLength(1);
      } finally {
        await catalog.close();
      }
    })
  );
});
