/**
 * Fast-path bulk writer for the chess puzzle seed.
 */
import type { Clock, Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';
import { bulk, raw, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { PuzzleSeedReporter } from './reporter';
import type { PuzzleBatchEntry, PuzzleTableRow } from './row';

type PuzzleInsertRow = PuzzleTableRow & {
  readonly created_at: string;
  readonly updated_at: string;
};

function insertPuzzlesBatchQuery(rows: readonly PuzzleInsertRow[]) {
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
    VALUES ${bulk(
      rows.map((row) => [
        row.id,
        row.created_at,
        row.updated_at,
        row.fen,
        row.moves,
        row.rating,
        row.rating_deviation,
        row.popularity,
        row.nb_plays,
        row.themes,
        row.game_url,
        row.opening_tags,
      ])
    )}
    ON CONFLICT (id) DO NOTHING
  `;
}

const SEEDED_TABLES: readonly string[] = ['chess_puzzles'];

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

export type InsertPuzzleTableRowsIo = {
  readonly createId: CreateId;
  readonly now: Clock['now'];
};

type PuzzleSeedFastPathDeps = {
  readonly timers: Timers;
  readonly log: Logger;
};

export class PuzzleSeedFastPath {
  constructor(
    private readonly db: SqlClient,
    private readonly deps?: PuzzleSeedFastPathDeps
  ) {}

  async detectManagedPostgres(): Promise<boolean> {
    try {
      await this.db.run(raw('CHECKPOINT'));
      return false;
    } catch {
      return true;
    }
  }

  async applySessionTuning(): Promise<boolean> {
    const log = this.#requireLog();
    const managed = await this.detectManagedPostgres();
    const stmts = managed ? SESSION_TUNING_MANAGED : SESSION_TUNING_SELF_HOSTED;
    if (managed) {
      log.info(
        'seed:puzzles: managed Postgres detected (CHECKPOINT denied) — conservative session tuning'
      );
    }
    for (const stmt of stmts) {
      try {
        await this.db.run(raw(stmt));
      } catch (err) {
        log.warn('seed:puzzles: session tuning failed (continuing)', {
          stmt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return managed;
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    const timers = this.#requireTimers();
    return new Promise((res) => timers.setTimeout(res, ms));
  }

  /** Bulk insert puzzle rows; returns accepted row count (`ON CONFLICT DO NOTHING`). */
  async insertPuzzleTableRows(
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
    await this.db.transaction(async (tx) => {
      const res = await tx.run(insertPuzzlesBatchQuery(insertRows));
      rowChanges = res.changes;
    });
    return rowChanges;
  }

  async flushPuzzleBatchFast(args: {
    reporter: PuzzleSeedReporter;
    state: SeedStats;
    createId: CreateId;
    now: Clock['now'];
  }): Promise<void> {
    const { reporter, state, createId, now } = args;
    if (state.batch.length === 0) return;
    const chunkStart = now();
    const rowChanges = await this.insertPuzzleTableRows(
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

  async writeLoadProgressFast(args: {
    loadId: string;
    sourceEtag: string;
    cursor: string | null;
    finishedAt: string | null;
    createId: CreateId;
    now: Clock['now'];
  }): Promise<void> {
    const { loadId, sourceEtag, cursor, finishedAt, now } = args;
    const nowIso = new Date(now()).toISOString();
    await this.db.run(sql<void>`
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
        ${nowIso},
        ${nowIso},
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

  async runInterimMaintenance(args: {
    reporter: PuzzleSeedReporter;
    state: SeedStats;
    deferIndexes: boolean;
    checkpointEvery: number;
  }): Promise<void> {
    const { reporter, state, deferIndexes, checkpointEvery } = args;
    if (deferIndexes || checkpointEvery <= 0) return;
    reporter.phase('Interim maintenance (CHECKPOINT + VACUUM ANALYZE)', {
      batchesFlushedSoFar: state.batchesFlushed,
      processedSoFar: state.processed,
    });
    await this.#tryRun({
      stmt: 'CHECKPOINT',
      message: 'seed:puzzles: CHECKPOINT skipped (insufficient privilege?)',
    });
    for (const table of SEEDED_TABLES) {
      await this.#tryRun({
        stmt: `VACUUM (ANALYZE, INDEX_CLEANUP off) ${table}`,
        message: 'seed:puzzles: interim VACUUM failed (continuing)',
        detail: { table },
      });
    }
  }

  async runFinalMaintenance(args: {
    reporter: PuzzleSeedReporter;
    rebuildIndexes: boolean;
  }): Promise<void> {
    const { reporter } = args;
    reporter.phase('Final maintenance (VACUUM ANALYZE)');
    for (const table of SEEDED_TABLES) {
      await this.#tryRun({
        stmt: `VACUUM (ANALYZE) ${table}`,
        message: 'seed:puzzles: final VACUUM failed (continuing)',
        detail: { table },
      });
    }
  }

  async #tryRun(args: {
    stmt: string;
    message: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const log = this.#requireLog();
    const { stmt, message, detail } = args;
    try {
      await this.db.run(raw(stmt));
    } catch (err) {
      log.warn(message, {
        ...(detail ?? {}),
        stmt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  #requireTimers(): Timers {
    if (this.deps === undefined) {
      throw new Error('PuzzleSeedFastPath: timers dependency required');
    }
    return this.deps.timers;
  }

  #requireLog(): Logger {
    if (this.deps === undefined) {
      throw new Error('PuzzleSeedFastPath: log dependency required');
    }
    return this.deps.log;
  }
}
