/**
 * Fast-path bulk writer for the chess puzzle seed.
 */
import {
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleLoadCol,
  ChessPuzzleCol,
} from '@libs/db/shared/chess-tables';
import type { Logger } from '@pkgs/logger';
import { raw, sql, type Sql, ident } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PuzzleBatchEntry } from './row';
import type { PuzzleSeedReporter } from './reporter';

function insertPuzzlesBatchQuery(insertRowsJson: string): Sql {
  return sql`INSERT INTO ${ident(CHESS_PUZZLES_TABLE.tableName)}
    (${ident(ChessPuzzleCol.id)}, ${ident(ChessPuzzleCol.fen)}, ${ident(ChessPuzzleCol.moves)},
     ${ident(ChessPuzzleCol.rating)}, ${ident(ChessPuzzleCol.ratingDeviation)},
     ${ident(ChessPuzzleCol.popularity)}, ${ident(ChessPuzzleCol.nbPlays)},
     ${ident(ChessPuzzleCol.themes)}, ${ident(ChessPuzzleCol.gameUrl)}, ${ident(ChessPuzzleCol.openingTags)})
    SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays,
           themes::jsonb, game_url, opening_tags::jsonb
    FROM jsonb_to_recordset(${insertRowsJson}::text::jsonb) AS batch_rows (
        id text,
        fen text,
        moves text,
        rating integer,
        rating_deviation integer,
        popularity integer,
        nb_plays integer,
        themes text,
        game_url text,
        opening_tags text
    )
    ON CONFLICT (${ident(ChessPuzzleCol.id)}) DO NOTHING`;
}

const SEEDED_TABLES: readonly string[] = [CHESS_PUZZLES_TABLE.tableName];

export async function detectManagedPostgres(db: SqlClient): Promise<boolean> {
  try {
    await db.run(raw('CHECKPOINT'));
    return false;
  } catch {
    return true;
  }
}

const SESSION_TUNING_SELF_HOSTED: readonly string[] = [
  "SET synchronous_commit = 'off'",
  "SET maintenance_work_mem = '256MB'",
  "SET work_mem = '64MB'",
  'SET statement_timeout = 0',
  'SET idle_in_transaction_session_timeout = 0',
];

const SESSION_TUNING_MANAGED: readonly string[] = [
  "SET synchronous_commit = 'on'",
  "SET maintenance_work_mem = '64MB'",
  "SET work_mem = '32MB'",
  'SET statement_timeout = 0',
  'SET idle_in_transaction_session_timeout = 0',
];

export async function applySessionTuning(
  db: SqlClient,
  log: Logger
): Promise<boolean> {
  const managed = await detectManagedPostgres(db);
  const stmts = managed ? SESSION_TUNING_MANAGED : SESSION_TUNING_SELF_HOSTED;
  if (managed) {
    log.info(
      'seed:puzzles: managed Postgres detected (CHECKPOINT denied) — conservative session tuning'
    );
  }
  for (const stmt of stmts) {
    try {
      await db.run(ident(stmt));
    } catch (err) {
      log.warn('seed:puzzles: session tuning failed (continuing)', {
        stmt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return managed;
}

export type SeedStats = {
  processed: number;
  rowsInserted: number;
  batchesFlushed: number;
  lastPuzzleId: string | null;
  startedAt: number;
  batch: PuzzleBatchEntry[];
};

export function createSeedStats(initialCursor: string | null): SeedStats {
  return {
    processed: 0,
    rowsInserted: 0,
    batchesFlushed: 0,
    lastPuzzleId: initialCursor,
    startedAt: performance.now(),
    batch: [],
  };
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((res) => setTimeout(res, ms));
}

function buildInsertRows(state: SeedStats): readonly Record<string, unknown>[] {
  return state.batch.map((b) => ({ ...b.row }));
}

export async function flushPuzzleBatchFast(args: {
  db: SqlClient;
  reporter: PuzzleSeedReporter;
  state: SeedStats;
}): Promise<void> {
  const { db, reporter, state } = args;
  if (state.batch.length === 0) return;
  const chunkStart = performance.now();
  const insertRows = buildInsertRows(state);
  let rowChanges = 0;
  await db.transaction(async (tx) => {
    const res = await tx.run(
      insertPuzzlesBatchQuery(JSON.stringify(insertRows))
    );
    rowChanges = res.changes;
  });
  state.rowsInserted += rowChanges;
  state.batchesFlushed += 1;
  state.batch.length = 0;
  reporter.batchSummary('seed:puzzles: batch', {
    processed: state.processed,
    rowsInserted: state.rowsInserted,
    batchRowsAccepted: rowChanges,
    batchMs: Math.round(performance.now() - chunkStart),
    lastPuzzleId: state.lastPuzzleId,
  });
}

async function tryRun(args: {
  db: SqlClient;
  log: Logger;
  stmt: string;
  message: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { db, log, stmt, message, detail } = args;
  try {
    await db.run(ident(stmt));
  } catch (err) {
    log.warn(message, {
      ...(detail ?? {}),
      stmt,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function writeLoadProgressFast(args: {
  db: SqlClient;
  loadId: string;
  sourceEtag: string;
  cursor: string | null;
  finishedAt: string | null;
}): Promise<void> {
  const { db, loadId, sourceEtag, cursor, finishedAt } = args;
  await db.run(sql`INSERT INTO ${ident(CHESS_PUZZLE_LOAD_TABLE.tableName)}
     (${ident(ChessPuzzleLoadCol.id)}, ${ident(ChessPuzzleLoadCol.sourceEtag)},
      ${ident(ChessPuzzleLoadCol.cursor)}, ${ident(ChessPuzzleLoadCol.finishedAt)})
     VALUES (${loadId}, ${sourceEtag}, ${cursor}, ${finishedAt})
     ON CONFLICT (${ident(ChessPuzzleLoadCol.id)}) DO UPDATE SET
       ${ident(ChessPuzzleLoadCol.sourceEtag)} = excluded.${ident(ChessPuzzleLoadCol.sourceEtag)},
       ${ident(ChessPuzzleLoadCol.cursor)} = excluded.${ident(ChessPuzzleLoadCol.cursor)},
       ${ident(ChessPuzzleLoadCol.finishedAt)} = excluded.${ident(ChessPuzzleLoadCol.finishedAt)}`);
}

export async function runInterimMaintenance(args: {
  db: SqlClient;
  reporter: PuzzleSeedReporter;
  log: Logger;
  state: SeedStats;
  deferIndexes: boolean;
  checkpointEvery: number;
}): Promise<void> {
  const { db, reporter, log, state, deferIndexes, checkpointEvery } = args;
  if (deferIndexes || checkpointEvery <= 0) return;
  reporter.phase('Interim maintenance (CHECKPOINT + VACUUM ANALYZE)', {
    batchesFlushedSoFar: state.batchesFlushed,
    processedSoFar: state.processed,
  });
  await tryRun({
    db,
    log,
    stmt: 'CHECKPOINT',
    message: 'seed:puzzles: CHECKPOINT skipped (insufficient privilege?)',
  });
  for (const table of SEEDED_TABLES) {
    await tryRun({
      db,
      log,
      stmt: `VACUUM (ANALYZE, INDEX_CLEANUP off) ${table}`,
      message: 'seed:puzzles: interim VACUUM failed (continuing)',
      detail: { table },
    });
  }
}

export async function runFinalMaintenance(args: {
  db: SqlClient;
  reporter: PuzzleSeedReporter;
  log: Logger;
  rebuildIndexes: boolean;
}): Promise<void> {
  const { db, reporter, log } = args;
  reporter.phase('Final maintenance (VACUUM ANALYZE)');
  for (const table of SEEDED_TABLES) {
    await tryRun({
      db,
      log,
      stmt: `VACUUM (ANALYZE) ${table}`,
      message: 'seed:puzzles: final VACUUM failed (continuing)',
      detail: { table },
    });
  }
}
