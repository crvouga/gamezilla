/**
 * Fast-path bulk writer for the chess puzzle seed plus the maintenance
 * helpers that run between batches and at the end of the seed.
 *
 * Bypasses {@link PatchDb.write}'s `recomputeTouchedSnapshots` round-trip
 * by writing patches and snapshots in one transaction with two batched
 * `jsonb_to_recordset` inserts. Both inserts use `ON CONFLICT DO NOTHING`
 * so re-seeds skip already-loaded puzzles instead of churning dead tuples.
 */
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { INSERT_PATCHES_BATCH } from '@gamezilla/patch-db/impl-postgres/sql-constants';
import { CHESS_PUZZLE_ENTITY_TYPE } from '@gamezilla/chess/shared/chess-puzzle-entities';
import type { PuzzleBatchEntry } from './row';
import type { PuzzleSeedReporter } from './reporter';

/**
 * Per-session tuning, applied **once** synchronously after the single
 * seed `pg.Client` connects (see `createSqlClient` in the entry script).
 *
 * The previous implementation registered an async `pool.on('connect', …)`
 * handler — but `pg.Pool` does not await that handler before returning a
 * client to the caller, so the first few batches could run with the
 * server's default `synchronous_commit = on`, defeating the WAL win.
 * Awaiting these statements on a single dedicated `Client` removes that
 * race entirely while also capping connection count at 1.
 *
 * These knobs trade durability of the *most recent* committed batches for
 * far less WAL fsync pressure during a multi-million-row bulk seed. The
 * seed is fully resumable from the persisted `chess.puzzle.load` cursor,
 * so losing the last few unflushed commits on a crash is acceptable.
 *
 * - `synchronous_commit = off` — commit returns before the WAL record is
 *   fsync'd to disk; PlanetScale still persists WAL on its own cadence,
 *   just no longer per-COMMIT.
 * - `maintenance_work_mem = '256MB'` — speeds up the inline VACUUMs we
 *   run between batches so they finish before the next checkpoint.
 * - `work_mem = '64MB'` — keeps the recursive-CTE reads in patch-db's
 *   start-of-seed `chess.puzzle.load` lookup cheap.
 * - `statement_timeout = 0` — explicit unlimited; managed Postgres
 *   defaults can be aggressive and our `VACUUM ANALYZE` may run for
 *   minutes on a multi-GB table.
 * - `idle_in_transaction_session_timeout = '60s'` — defensive: if the
 *   seed were ever stuck in a transaction, the server kills the session
 *   instead of silently holding locks (and a connection slot) forever.
 */
const SESSION_TUNING_SQL: readonly string[] = [
  "SET synchronous_commit = 'off'",
  "SET maintenance_work_mem = '256MB'",
  "SET work_mem = '64MB'",
  'SET statement_timeout = 0',
  "SET idle_in_transaction_session_timeout = '60s'",
];

export async function applySessionTuning(
  sql: SqlClient,
  log: Logger
): Promise<void> {
  for (const stmt of SESSION_TUNING_SQL) {
    try {
      await sql.run(stmt);
    } catch (err) {
      log.warn('seed:puzzles: session tuning failed (continuing)', {
        stmt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export type SeedStats = {
  processed: number;
  /** Patches accepted by the DB (rowCount of the patches insert). */
  patchesInserted: number;
  /** Snapshots accepted by the DB (rowCount of the snapshots insert). */
  snapshotsInserted: number;
  /** Number of batch flushes since the start of the seed. */
  batchesFlushed: number;
  lastPuzzleId: string | null;
  startedAt: number;
  /** Buffered rows waiting to flush. */
  batch: PuzzleBatchEntry[];
};

export function createSeedStats(initialCursor: string | null): SeedStats {
  return {
    processed: 0,
    patchesInserted: 0,
    snapshotsInserted: 0,
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

/**
 * Fast-path snapshot insert: `DO NOTHING` (not `DO UPDATE`) so re-seeds of
 * an already-loaded row don't churn dead tuples. The patches table is the
 * source of truth — if a snapshot somehow drifts from its patch chain,
 * `recomputeTouchedSnapshots` (run by the normal `PatchDb.write` path)
 * will repair it on the next mutation.
 */
const INSERT_SNAPSHOTS_BATCH_DO_NOTHING = `INSERT INTO snapshots (entity_id, entity_type, attributes)
    SELECT entity_id, entity_type, attributes
    FROM jsonb_to_recordset(?::text::jsonb) AS batch_rows (
        entity_id text,
        entity_type text,
        attributes jsonb
    )
    ON CONFLICT (entity_type, entity_id) DO NOTHING`;

function buildPatchInsertRows(
  state: SeedStats,
  nowIso: string
): readonly Record<string, unknown>[] {
  return state.batch.map((b) => ({
    patch_id: b.patchId,
    entity_id: b.puzzleId,
    entity_type: CHESS_PUZZLE_ENTITY_TYPE,
    attributes: b.patchAttrs,
    created_at: nowIso,
    recorded_at: nowIso,
    parent_id: null,
  }));
}

function buildSnapshotInsertRows(
  state: SeedStats
): readonly Record<string, unknown>[] {
  return state.batch.map((b) => ({
    entity_id: b.puzzleId,
    entity_type: CHESS_PUZZLE_ENTITY_TYPE,
    attributes: b.snapshotAttrs,
  }));
}

export async function flushPuzzleBatchFast(args: {
  sql: SqlClient;
  reporter: PuzzleSeedReporter;
  state: SeedStats;
}): Promise<void> {
  const { sql, reporter, state } = args;
  if (state.batch.length === 0) return;
  const chunkStart = performance.now();
  const nowIso = new Date().toISOString();
  const patchRows = buildPatchInsertRows(state, nowIso);
  const snapshotRows = buildSnapshotInsertRows(state);

  let patchChanges = 0;
  let snapshotChanges = 0;
  await sql.transaction(async (tx) => {
    const patchRes = await tx.run(INSERT_PATCHES_BATCH, [
      JSON.stringify(patchRows),
    ]);
    const snapshotRes = await tx.run(INSERT_SNAPSHOTS_BATCH_DO_NOTHING, [
      JSON.stringify(snapshotRows),
    ]);
    patchChanges = patchRes.changes;
    snapshotChanges = snapshotRes.changes;
  });

  state.patchesInserted += patchChanges;
  state.snapshotsInserted += snapshotChanges;
  state.batchesFlushed += 1;
  state.batch.length = 0;

  reporter.batchSummary('seed:puzzles: batch', {
    processed: state.processed,
    patchesInserted: state.patchesInserted,
    snapshotsInserted: state.snapshotsInserted,
    batchPatchesAccepted: patchChanges,
    batchSnapshotsAccepted: snapshotChanges,
    batchMs: Math.round(performance.now() - chunkStart),
    lastPuzzleId: state.lastPuzzleId,
  });
}

const SEEDED_TABLES: readonly string[] = ['public.patches', 'public.snapshots'];

async function tryRun(args: {
  sql: SqlClient;
  log: Logger;
  stmt: string;
  message: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { sql, log, stmt, message, detail } = args;
  try {
    await sql.run(stmt);
  } catch (err) {
    log.warn(message, {
      ...(detail ?? {}),
      stmt,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Periodic maintenance: flush WAL + reclaim dead tuples on the seeded
 * tables. CHECKPOINT may require elevated privileges on managed Postgres
 * (PlanetScale, Neon, Supabase) — failure is logged and execution
 * continues.
 *
 * `INDEX_CLEANUP off` skips the per-cycle index scan for speed; a final
 * unconstrained `VACUUM ANALYZE` runs at the end of the seed via
 * {@link runFinalMaintenance}.
 */
export async function runInterimMaintenance(args: {
  sql: SqlClient;
  reporter: PuzzleSeedReporter;
  log: Logger;
  state: SeedStats;
}): Promise<void> {
  const { sql, reporter, log, state } = args;
  reporter.phase('Interim maintenance (CHECKPOINT + VACUUM ANALYZE)', {
    batchesFlushedSoFar: state.batchesFlushed,
    processedSoFar: state.processed,
  });
  await tryRun({
    sql,
    log,
    stmt: 'CHECKPOINT',
    message: 'seed:puzzles: CHECKPOINT skipped (insufficient privilege?)',
  });
  for (const table of SEEDED_TABLES) {
    await tryRun({
      sql,
      log,
      stmt: `VACUUM (ANALYZE, INDEX_CLEANUP off) ${table}`,
      message: 'seed:puzzles: interim VACUUM failed (continuing)',
      detail: { table },
    });
  }
}

async function reindexPuzzleIndexes(
  sql: SqlClient,
  log: Logger
): Promise<void> {
  // `REINDEX INDEX CONCURRENTLY` cannot run inside a transaction block.
  // We list only `pdb_idx_chess_puzzle__*` so the seed doesn't bloat by
  // rebuilding unrelated declarative indexes belonging to other features.
  const idxRows = await sql.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname LIKE 'pdb_idx_chess_puzzle__%' ORDER BY indexname"
  );
  for (const { indexname } of idxRows) {
    await tryRun({
      sql,
      log,
      stmt: `REINDEX INDEX CONCURRENTLY "${indexname}"`,
      message: 'seed:puzzles: REINDEX failed (continuing)',
      detail: { indexname },
    });
  }
}

export async function runFinalMaintenance(args: {
  sql: SqlClient;
  reporter: PuzzleSeedReporter;
  log: Logger;
  rebuildIndexes: boolean;
}): Promise<void> {
  const { sql, reporter, log, rebuildIndexes } = args;
  reporter.phase('Final maintenance (VACUUM ANALYZE)');
  for (const table of SEEDED_TABLES) {
    await tryRun({
      sql,
      log,
      stmt: `VACUUM (ANALYZE) ${table}`,
      message: 'seed:puzzles: final VACUUM failed (continuing)',
      detail: { table },
    });
  }
  if (!rebuildIndexes) return;
  reporter.phase('Rebuild puzzle indexes (REINDEX CONCURRENTLY)');
  await reindexPuzzleIndexes(sql, log);
}
