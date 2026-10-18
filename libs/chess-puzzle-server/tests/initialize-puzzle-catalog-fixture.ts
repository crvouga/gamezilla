import { beforeAll } from 'bun:test';
import { InitializePuzzleCatalog } from '@libs/chess-puzzle-server/initialize-puzzle-catalog';
import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from '@libs/chess-puzzle-server/load-file-constants';
import { puzzleCatalogueTopic } from '@libs/game-puzzle-shared/catalogue-topics';
import { chessPuzzles } from '@libs/game-puzzle-shared/puzzle-tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createLogger } from '@pkgs/logger-shared/logger';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared/in-memory';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { syncEngineTopicSeq } from '@pkgs/sync-engine-shared/tables';

let emptyCatalog: Uint8Array;
beforeAll(async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(
      db,
      registerTables([chessPuzzles, syncEngineTopicSeq]),
      { ownership: 'declared-only' }
    );
    emptyCatalog = await db.exportDatabaseBytes();
  } finally {
    await db.disconnect();
  }
});

export async function openCatalog(csv: string) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await db.importDatabaseBytes(emptyCatalog);
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
const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';

export function csv(id: string, rating: number): string {
  return `${HEADER}\n${id},${FEN},d2c3 d4g1,${rating},112,100,43,mate mateIn1,,`;
}
