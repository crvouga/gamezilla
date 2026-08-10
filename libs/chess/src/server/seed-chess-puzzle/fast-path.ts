/**
 * Fast-path bulk writer for the chess puzzle seed.
 */
import type { Clock, Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { PuzzleSeedReporter } from './reporter';
import type { PuzzleBatchEntry, PuzzleTableRow } from './row';

type PuzzleInsertRow = PuzzleTableRow & {
  readonly created_at: string;
  readonly updated_at: string;
};

function insertPuzzlesBatchQuery(insertRowsJson: string) {
  return sql<void>`
    INSERT INTO chess_puzzles (
      id,
      created_at,
      updated_at,
      fen,
      moves,
      rating,
      rating_deviation,
      popularity,
      nb_plays,
      themes,
      game_url,
      opening_tags
    )
    SELECT
      id,
      created_at::timestamptz,
      updated_at::timestamptz,
      fen,
      moves,
      rating,
      rating_deviation,
      popularity,
      nb_plays,
      themes::jsonb,
      game_url,
      opening_tags::jsonb
    FROM jsonb_to_recordset(${insertRowsJson}::text::jsonb)
      AS batch_rows(
        id text,
        created_at text,
        updated_at text,
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
    ON CONFLICT (id) DO NOTHING
  `;
}

const SEEDED_TABLES: readonly string[] = ['chess_puzzles'];

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
      await db.run(raw(stmt));
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

export function createSeedStats(
  initialCursor: string | null,
  now: Clock['now']
): SeedStats {
  return {
    processed: 0,
    rowsInserted: 0,
    batchesFlushed: 0,
    lastPuzzleId: initialCursor,
    startedAt: now(),
    batch: [],
  };
}

export function sleep(ms: number, timers: Timers): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((res) => timers.setTimeout(res, ms));
}

export type InsertPuzzleTableRowsIo = {
  readonly createId: CreateId;
  readonly now: Clock['now'];
};

/** Bulk insert puzzle rows; returns accepted row count (`ON CONFLICT DO NOTHING`). */
export async function insertPuzzleTableRows(
  db: SqlClient,
  rows: readonly PuzzleTableRow[],
  io: InsertPuzzleTableRowsIo
): Promise<number> {
  if (rows.length === 0) return 0;
  const nowIso = new Date(io.now()).toISOString();
  const insertRows: PuzzleInsertRow[] = rows.map((row) => ({
    ...row,
    created_at: nowIso,
    updated_at: nowIso,
  }));
  let rowChanges = 0;
  await db.transaction(async (tx) => {
    const res = await tx.run(
      insertPuzzlesBatchQuery(JSON.stringify(insertRows))
    );
    rowChanges = res.changes;
  });
  return rowChanges;
}

export async function flushPuzzleBatchFast(args: {
  db: SqlClient;
  reporter: PuzzleSeedReporter;
  state: SeedStats;
  createId: CreateId;
  now: Clock['now'];
}): Promise<void> {
  const { db, reporter, state, createId, now } = args;
  if (state.batch.length === 0) return;
  const chunkStart = now();
  const rowChanges = await insertPuzzleTableRows(
    db,
    state.batch.map((b) => b.row),
    { createId, now }
  );
  state.rowsInserted += rowChanges;
  state.batchesFlushed += 1;
  state.batch.length = 0;
  reporter.batchSummary('seed:puzzles: batch', {
    processed: state.processed,
    rowsInserted: state.rowsInserted,
    batchRowsAccepted: rowChanges,
    batchMs: Math.round(now() - chunkStart),
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
    await db.run(raw(stmt));
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
  createId: CreateId;
  now: Clock['now'];
}): Promise<void> {
  const { db, loadId, sourceEtag, cursor, finishedAt, now } = args;
  const nowIso = new Date(now()).toISOString();
  await db.run(sql<void>`
    INSERT INTO chess_puzzle_load (
      id,
      created_at,
      updated_at,
      source_etag,
      cursor,
      finished_at
    )
    VALUES (
      ${loadId},
      ${nowIso}::timestamptz,
      ${nowIso}::timestamptz,
      ${sourceEtag},
      ${cursor},
      ${finishedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      source_etag = excluded.source_etag,
      cursor = excluded.cursor,
      finished_at = excluded.finished_at,
      updated_at = excluded.updated_at
  `);
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
