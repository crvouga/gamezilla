import { describe, expect, test } from 'bun:test';
import { ChessPuzzleLoadFileSeeder } from '@libs/chess-puzzle-server/chess-puzzle-load-file-seeder';
import { PuzzleValidationReport } from '@libs/chess-puzzle-server/puzzle-validation-report';
import { validatePuzzleTable } from '@libs/chess-puzzle-server/puzzle-validation-sources';
import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createLogger } from '@pkgs/logger-shared/logger';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';
const WHITE_SOLVES =
  '6Qk/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K b - - 0 28,h8g8 f1f8';

const CSV = [
  HEADER,
  `a1,${FEN},d2c3 d4g1,1275,112,100,43,mate mateIn1,,`,
  `a2,${WHITE_SOLVES},598,81,-20,174,mate,,Italian_Game`,
  `dupPos,${FEN.replace(' 1 32', ' 0 50')},d2c3 d4g1,1300,90,100,10,mate,,`,
  `odd,${FEN},d2c3,1275,112,100,43,mate,,`,
  `illegal,${FEN},d2c3 g1g2,1275,112,100,43,mate,,`,
  // Castles in the line without the castling right in the position.
  'noCastle,r3k3/8/8/8/8/8/8/R3K2R b q - 0 1,a8b8 e1g1,1250,90,100,50,endgame,,',
  // Seven ranks: not a position at all.
  'badFen,8/8/8/8/8/8/8 w - - 0 1,e2e4 e7e5,1250,90,100,50,opening,,',
].join('\n');

let idSeq = 0;

async function openDb(): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(db, registerTables([...CHESS_TABLES]), {
    ownership: 'declared-only',
  });
  return db;
}

async function ingest(db: SqlClient, csv: string) {
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(store, 'in.csv', csv, 'text/csv');
  return new ChessPuzzleLoadFileSeeder({
    loadFileStore: store,
    loadFileKey: 'in.csv',
    createId: () => `gen-${(idSeq += 1)}`,
    now: () => 1_700_000_000_000,
  }).ingest({
    sqlClient: db,
    logger: createLogger({ name: 'test', level: 'silent', now: () => 0 }),
  });
}

describe('ingest into chess_puzzles (real SQL)', () => {
  test('declares rating / popularity indexes and a unique position key', async () => {
    const db = await openDb();
    const indexes = await db.query(sql<{ name: string; unique: number }>`
      SELECT name, "unique" FROM pragma_index_list('chess_puzzles')
    `);
    const columnsOf = async (index: string) =>
      (
        await db.query(sql<{ name: string }>`
          SELECT name FROM pragma_index_info(${index})
        `)
      ).map((row) => row.name);
    const described = await Promise.all(
      indexes.map(async (ix) => ({
        columns: await columnsOf(ix.name),
        unique: ix.unique === 1,
      }))
    );
    expect(described).toContainEqual({ columns: ['rating'], unique: false });
    expect(described).toContainEqual({
      columns: ['popularity'],
      unique: false,
    });
    expect(described).toContainEqual({
      columns: ['position_key'],
      unique: true,
    });
  });

  test('lands only valid rows, dedupes, and a re-run is a no-op', async () => {
    const db = await openDb();
    const first = await ingest(db, CSV);
    expect(first).toMatchObject({ parsedRows: 7, validRows: 3 });
    expect(first.rowsInserted).toBe(2);
    expect(first.skipped).toMatchObject({
      duplicatePosition: 1,
      tooShort: 1,
      illegalMove: 2,
      invalidFen: 1,
      duplicateId: 0,
    });
    const rows = await db.query(sql<{ id: string; moves: string }>`
      SELECT id, moves FROM chess_puzzles ORDER BY id
    `);
    expect(rows).toEqual([
      { id: 'a1', moves: 'd2c3 d4g1' },
      { id: 'a2', moves: 'h8g8 f1f8' },
    ]);

    const again = await ingest(db, CSV);
    expect(again.rowsInserted).toBe(0);
    expect(again.skipped).toMatchObject({
      duplicateId: 2,
      duplicatePosition: 1,
    });

    const report = new PuzzleValidationReport();
    await validatePuzzleTable(db, report, 1);
    expect(report.summary()).toMatchObject({ checked: 2, invalid: 0 });
  });
});
