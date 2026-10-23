import { expect, test } from 'bun:test';
import { importPuzzleCsvBatch } from '@libs/chess-puzzle-server-ts/puzzle-import-batch';
import { puzzlePositionKey } from '@libs/chess-puzzle-shared-ts/puzzle-validation';
import { CHESS_TABLES } from '@libs/chess-sub-shared-ts/chess-tables';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared-ts/sub';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';

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
    registerTables([...GAME_PUZZLE_SUB.tables, ...CHESS_TABLES]),
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

test('a Lichess puzzle is stored through the catalogue exactly as chess validated it', async () => {
  const { db, tx } = await database();
  try {
    await importPuzzleCsvBatch(
      tx,
      `${HEADER}\nab12C,${FEN},d2c3 d4g1,1500,80,95,1234,mateIn1 mate short,https://lichess.org/abcdefgh#63,Sicilian_Defense_Najdorf Sicilian_Defense,\n`
    );
    expect(
      await db.query(sql<Record<string, unknown>>`
        SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays,
          themes, game_url, opening_tags, position_key
        FROM chess_puzzles
      `)
    ).toEqual([
      {
        id: 'ab12C',
        fen: FEN,
        moves: 'd2c3 d4g1',
        rating: 1500,
        rating_deviation: 80,
        popularity: 95,
        nb_plays: 1234,
        themes: '["mate","mateIn1","short"]',
        game_url: 'https://lichess.org/abcdefgh#63',
        opening_tags: '["Sicilian_Defense","Sicilian_Defense_Najdorf"]',
        position_key: puzzlePositionKey(FEN.split(' '), ['d2c3', 'd4g1']),
      },
    ]);
  } finally {
    await db.disconnect();
  }
});
