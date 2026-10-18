import { expect, test } from 'bun:test';
import { importPuzzleCsvBatch } from '@libs/chess-puzzle-server/puzzle-import-batch';
import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared/puzzle-tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate';
const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';
function csv(id: string, rating: number): string {
  return `${HEADER}\n${id},${FEN},d2c3 d4g1,${rating},112,100,43,mate mateIn1,,,\n`;
}
async function database() {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([...PUZZLE_TABLES, ...CHESS_TABLES]),
    {
      ownership: 'declared-only',
    }
  );
  let id = 0;
  const wrapped = wrapMutationDb(db, {
    actorId: 'manager',
    deviceId: 'device',
    accountId: 'manager',
    isAnon: false,
    now: () => new Date('2026-10-14T12:00:00Z'),
    createId: () => `id-${++id}`,
  });
  return { db, tx: wrapped.tx };
}

test('upserts refreshed puzzle ratings and skips duplicate positions and broken solutions', async () => {
  const { db, tx } = await database();
  try {
    expect(await importPuzzleCsvBatch(tx, csv('one', 1200))).toMatchObject({
      inserted: 1,
      updated: 0,
    });
    expect(await importPuzzleCsvBatch(tx, csv('one', 1300))).toMatchObject({
      inserted: 0,
      updated: 1,
    });
    expect(
      await importPuzzleCsvBatch(tx, csv('another-id', 1400))
    ).toMatchObject({ duplicates: 1 });
    expect(
      await importPuzzleCsvBatch(
        tx,
        csv('broken', 1400).replace('d2c3 d4g1', 'd2c3 a1a8')
      )
    ).toMatchObject({ rejected: 1 });
    expect(
      await db.query(
        sql<{
          id: string;
          rating: number;
        }>`SELECT id, rating FROM chess_puzzles`
      )
    ).toEqual([{ id: 'one', rating: 1300 }]);
    await tx.run(
      sql`UPDATE chess_puzzles SET deleted_at = ${'2026-10-14T13:00:00Z'} WHERE id = 'one'`
    );
    expect(await importPuzzleCsvBatch(tx, csv('one', 1500))).toMatchObject({
      duplicates: 1,
      updated: 0,
    });
  } finally {
    await db.disconnect();
  }
});

test('invalid CSV never partially applies a source part', async () => {
  const { db, tx } = await database();
  try {
    await expect(
      importPuzzleCsvBatch(tx, `${csv('one', 1200)}bad,column,count`)
    ).rejects.toThrow();
    expect(
      await db.query(sql<{ id: string }>`SELECT id FROM chess_puzzles`)
    ).toEqual([]);
  } finally {
    await db.disconnect();
  }
});
