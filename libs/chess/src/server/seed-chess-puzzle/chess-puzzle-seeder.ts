/**
 * Load Lichess puzzle CSV into PatchDB (`chess.puzzle` entities) via a
 * tightly-scoped fast-path that bypasses {@link PatchDb.write}'s
 * read-modify-write loop on `snapshots`. Idempotent: content-addressed
 * `patchId` per row; `INSERT … ON CONFLICT DO NOTHING` skips unchanged
 * rows on both `patches` *and* `snapshots`.
 *
 * Why a fast path: the generic write does
 *   1. INSERT into patches (batched)
 *   2. recursive-CTE re-read of those same patches
 *   3. UPSERT into snapshots (DO UPDATE → dead-tuple churn even for fresh rows)
 *   4. extra round-trip per batch to persist the resume cursor
 * For 2.65M Lichess puzzles that's ~530 batches × every step → multi-GB WAL
 * surge that PlanetScale's PITR pins as billable storage even after VACUUM.
 *
 * For a fresh seed every puzzle is its own root patch (`parent_id = null`),
 * the snapshot value equals that patch's user attributes, and the patch id
 * is content-addressed → we can write `patches` and `snapshots` in a
 * single transaction with two batched `jsonb_to_recordset` inserts using
 * `ON CONFLICT DO NOTHING` on both tables. The patch row is still written
 * so sync semantics remain intact for downstream clients.
 *
 * The seed assumes the `patches` and `snapshots` tables and the
 * `pdb_idx_chess_puzzle__*` declarative indexes already exist. Run the
 * standard migration step first (`bun run --filter @apps/api db:migrate`)
 * before invoking this script on a fresh database. Keeping migrations out
 * of the seed lets `@libs/chess` stay independent of `@apps/api`
 * (and Better Auth) and avoids a workspace-level dependency cycle.
 *
 * Connection model: the seed opens **exactly one** TCP session to Postgres
 * via `pg.Client` (not `pg.Pool`). The seed loop is fully serial — one
 * batch transaction at a time with awaited `CHECKPOINT` / `VACUUM` /
 * progress-write statements between batches — so a pool only adds idle
 * connections that count against PlanetScale's `max_connections` budget
 * without speeding anything up. PgBouncer-fronted endpoints work too as
 * long as they run in **session pooling** mode (transaction mode breaks
 * `SET …` statements that need to persist across the seed's batches).
 *
 * Local (Doppler `dev`, `DB_URL` → PGlite socket or other Postgres):
 *   DOPPLER_CONFIG=dev doppler run -- bun run --filter @libs/chess seed:puzzles
 *
 * Production (Doppler `prd`, `DB_URL` → Postgres):
 *   DOPPLER_CONFIG=prd doppler run -- bun run --filter @libs/chess seed:puzzles
 *
 * Options: `--source`, `--cache-dir`, `--batch-size` (default 1000),
 *   `--limit`, `--no-resume`, `--dry-run`, `--pace-ms` (default 250),
 *   `--checkpoint-every` (default 25), `--progress-every` (default 10),
 *   `--rebuild-indexes`, `--json` (one JSON log line per event),
 *   `--pretty` / `--no-pretty` (TTY progress styling).
 * Default: colored progress on stderr when stderr is a TTY and `CI` is unset.
 */

import {
  CHESS_PUZZLE_ENTITY_TYPE,
  CHESS_PUZZLE_LOAD_ENTITY_ID,
  CHESS_PUZZLE_LOAD_ENTITY_TYPE,
  ChessPuzzleLoadAttr,
} from '@libs/chess/shared/chess-puzzle-entities';
import { createLogger, type Logger } from '@pkgs/logger';
import { createDopplerSecretStoreForScripts } from '@pkgs/secret-store';
import { SqlClientImplPgClient } from '@pkgs/sql-client/impl-pg-client';
import { sanitizePostgresUrlForNodePg } from '@pkgs/sql-client/sanitize-postgres-url-for-node-pg';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplPostgres } from '@pkgs/patch-db/impl-postgres/impl-postgres';
import {
  PATCHES_DB_SYSTEM_CONTEXT,
  type PatchDb,
  type PatchInput,
} from '@pkgs/patch-db/interface';
import { PatchDbCompactionPolicyRegistry } from '@pkgs/patch-db/policy/compaction-policy';
import { Client } from 'pg';
import type { Cli } from './cli';
import { parseCli } from './cli';
import {
  applySessionTuning,
  createSeedStats,
  flushPuzzleBatchFast,
  runFinalMaintenance,
  runInterimMaintenance,
  type SeedStats,
  sleep,
} from './fast-path';
import { contentAddressedPatchId, rowToPuzzleBatchEntry } from './row';
import { createPuzzleSeedReporter, type PuzzleSeedReporter } from './reporter';
import {
  ensureCachedArchive,
  iteratePuzzleRows,
  type IteratePuzzleRowsOptions,
  type ResolvedSource,
} from './streaming';

type StreamContext = {
  cli: Cli;
  resolved: ResolvedSource;
  sql: SqlClient;
  patchDb: PatchDb;
  reporter: PuzzleSeedReporter;
  log: Logger;
  resumeCursor: string | null;
};

type StreamRowState = {
  state: SeedStats;
  lastProgressBatchIdx: number;
};

type PuzzleLoadPriorState = {
  sourceEtag: string | null;
  cursor: string | null;
  finishedAt: string | null;
};

export class ChessPuzzleSeeder {
  readonly #cli: Cli;

  static fromArgv(argv: string[]): ChessPuzzleSeeder {
    return new ChessPuzzleSeeder(parseCli(argv));
  }

  constructor(config: Cli) {
    this.#cli = config;
  }

  async run(): Promise<void> {
    const log = createLogger({ name: 'db:seed-puzzles' });
    const reporter = createPuzzleSeedReporter({
      pretty: this.#cli.prettyOutput,
      logger: log,
    });
    const resolved = await this.#resolveArchive(log, reporter);
    if (this.#cli.dryRun) {
      await this.#runDryRun(resolved, reporter);
      return;
    }
    await this.#runSeed(resolved, reporter, log);
  }

  /**
   * Open exactly one TCP session to Postgres for the entire seed run.
   *
   * - `keepAlive: true` + a 10s initial probe keeps long-running idle stretches
   *   (e.g. parsing a chunk of CSV between batches) from being silently
   *   killed by load-balancers / NAT timers in front of managed Postgres.
   * - `application_name=seed:puzzles` makes this session easy to spot in
   *   `pg_stat_activity` and PlanetScale's connection dashboard.
   *
   * Pools (`pg.Pool`) are intentionally not used: the seed loop is fully
   * serial, so a pool only adds idle connections that count against the
   * primary's `max_connections` budget without any throughput benefit.
   */
  #createSqlClient(databaseUrl: string): {
    sql: SqlClient;
    client: Client;
  } {
    const client = new Client({
      connectionString: sanitizePostgresUrlForNodePg(databaseUrl),
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      application_name: 'seed:puzzles',
    });
    return { sql: new SqlClientImplPgClient(client), client };
  }

  #createSeedPatchDb(sql: SqlClient): PatchDb {
    const compaction = new PatchDbCompactionPolicyRegistry();
    compaction.registerAll({
      [CHESS_PUZZLE_ENTITY_TYPE]: { keepLatest: 1 },
      [CHESS_PUZZLE_LOAD_ENTITY_TYPE]: { keepLatest: 1 },
    });
    // `autoCompactOnWrite: false`: each puzzle's `patchId` is content-addressed
    // and `INSERT … ON CONFLICT DO NOTHING` keeps it at exactly one patch per
    // entity, so post-write compaction is always a no-op. This PatchDb is
    // only used for the small `chess.puzzle.load` progress entity (a few
    // writes total) — bulk puzzle inserts go through `flushPuzzleBatchFast`.
    return new PatchDbImplPostgres(sql, {
      autoCompactOnWrite: false,
      compactionPolicy: compaction.resolve,
    });
  }

  #iterateProgressOptions(
    reporter: PuzzleSeedReporter
  ): IteratePuzzleRowsOptions {
    return {
      onParsedRowCount: ({ parsedRows }) => {
        reporter.parseProgress(parsedRows);
      },
      progressEveryDataRows: 25_000,
    };
  }

  async #readLoadSnapshotAttrs(
    db: PatchDb
  ): Promise<Record<string, unknown> | null> {
    const [row] = await db.read(
      [
        {
          entityType: CHESS_PUZZLE_LOAD_ENTITY_TYPE,
          entityId: CHESS_PUZZLE_LOAD_ENTITY_ID,
          limit: 1,
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    const e = row?.entities[0];
    return e !== undefined ? e.attributes : null;
  }

  #loadStateFromAttrs(
    attrs: Record<string, unknown> | null
  ): PuzzleLoadPriorState {
    if (attrs === null) {
      return { sourceEtag: null, cursor: null, finishedAt: null };
    }
    return {
      sourceEtag: ChessPuzzleLoadAttr.sourceEtag.from(attrs),
      cursor: ChessPuzzleLoadAttr.cursor.from(attrs),
      finishedAt: ChessPuzzleLoadAttr.finishedAt.from(attrs),
    };
  }

  #loadProgressPatchInput(args: {
    sourceEtag: string;
    cursor: string | null;
    finishedAt: string | null;
  }): PatchInput {
    const attributes: Record<string, unknown> = {
      [ChessPuzzleLoadAttr.sourceEtag.key]: args.sourceEtag,
    };
    if (args.cursor !== null && args.cursor.length > 0) {
      attributes[ChessPuzzleLoadAttr.cursor.key] = args.cursor;
    }
    if (args.finishedAt !== null && args.finishedAt.length > 0) {
      attributes[ChessPuzzleLoadAttr.finishedAt.key] = args.finishedAt;
    }
    return {
      entityId: CHESS_PUZZLE_LOAD_ENTITY_ID,
      entityType: CHESS_PUZZLE_LOAD_ENTITY_TYPE,
      patchId: contentAddressedPatchId(attributes),
      parentId: null,
      attributes: attributes as PatchInput['attributes'],
    };
  }

  async #persistResumeCursor(args: {
    patchDb: PatchDb;
    state: SeedStats;
    sourceEtag: string;
  }): Promise<void> {
    const { patchDb, state, sourceEtag } = args;
    if (state.lastPuzzleId === null) return;
    await patchDb.write(
      [
        this.#loadProgressPatchInput({
          sourceEtag,
          cursor: state.lastPuzzleId,
          finishedAt: null,
        }),
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
  }

  async #resolveArchive(
    log: Logger,
    reporter: PuzzleSeedReporter
  ): Promise<ResolvedSource> {
    const cli = this.#cli;
    reporter.phase('Lichess puzzle seed', {
      source: cli.source,
      cacheDir: cli.cacheDir,
      batchSize: cli.batchSize,
      paceMs: cli.paceMs,
      checkpointEvery: cli.checkpointEvery,
      progressEvery: cli.progressEvery,
      rebuildIndexes: cli.rebuildIndexes,
      limit: cli.limit,
      dryRun: cli.dryRun,
      prettyOutput: cli.prettyOutput,
    });
    reporter.phase('Resolve puzzle archive (HEAD / cache / download)', {
      cacheDir: cli.cacheDir,
    });
    const resolved = await ensureCachedArchive({
      source: cli.source,
      cacheDir: cli.cacheDir,
      log,
      onDownloadProgress: (p) => reporter.downloadProgress(p),
    });
    reporter.endDownloadProgressLine();
    reporter.phase('Archive ready', {
      path: resolved.localPath,
      isZst: resolved.isZst,
      etagPreview:
        resolved.etag.length > 48
          ? `${resolved.etag.slice(0, 48)}…`
          : resolved.etag,
    });
    return resolved;
  }

  async #runDryRun(
    resolved: ResolvedSource,
    reporter: PuzzleSeedReporter
  ): Promise<void> {
    const cli = this.#cli;
    reporter.phase('Dry run — parse CSV only (no database writes)', {
      path: resolved.localPath,
    });
    let n = 0;
    try {
      await iteratePuzzleRows(
        resolved,
        async (row) => {
          if (rowToPuzzleBatchEntry(row) === null) return true;
          n += 1;
          return cli.limit === null || n < cli.limit;
        },
        this.#iterateProgressOptions(reporter)
      );
    } finally {
      reporter.endParseProgressLine();
    }
    reporter.phase('Dry run complete', { validPuzzleRowsSeen: n });
  }

  #shouldSkipResumedRow(
    row: Record<string, unknown>,
    resumeCursor: string | null
  ): boolean {
    if (resumeCursor === null) return false;
    const id = String(row['PuzzleId'] ?? '').trim();
    return id.length > 0 && id.localeCompare(resumeCursor) <= 0;
  }

  async #maybeFlushBatch(args: {
    ctx: StreamContext;
    rowState: StreamRowState;
  }): Promise<void> {
    const { ctx, rowState } = args;
    if (rowState.state.batch.length < ctx.cli.batchSize) return;
    await flushPuzzleBatchFast({
      sql: ctx.sql,
      reporter: ctx.reporter,
      state: rowState.state,
    });
    if (
      rowState.state.batchesFlushed - rowState.lastProgressBatchIdx >=
      ctx.cli.progressEvery
    ) {
      await this.#persistResumeCursor({
        patchDb: ctx.patchDb,
        state: rowState.state,
        sourceEtag: ctx.resolved.etag,
      });
      rowState.lastProgressBatchIdx = rowState.state.batchesFlushed;
    }
    if (
      ctx.cli.checkpointEvery > 0 &&
      rowState.state.batchesFlushed % ctx.cli.checkpointEvery === 0
    ) {
      await runInterimMaintenance({
        sql: ctx.sql,
        reporter: ctx.reporter,
        log: ctx.log,
        state: rowState.state,
      });
    }
    await sleep(ctx.cli.paceMs);
  }

  async #processPuzzleRow(args: {
    ctx: StreamContext;
    rowState: StreamRowState;
    row: Record<string, unknown>;
  }): Promise<boolean> {
    const { ctx, rowState, row } = args;
    if (this.#shouldSkipResumedRow(row, ctx.resumeCursor)) return true;
    const entry = rowToPuzzleBatchEntry(row);
    if (entry === null) return true;
    rowState.state.batch.push(entry);
    rowState.state.processed += 1;
    rowState.state.lastPuzzleId = entry.puzzleId;
    await this.#maybeFlushBatch({ ctx, rowState });
    return ctx.cli.limit === null || rowState.state.processed < ctx.cli.limit;
  }

  async #streamPuzzles(ctx: StreamContext): Promise<SeedStats> {
    const rowState: StreamRowState = {
      state: createSeedStats(ctx.resumeCursor),
      lastProgressBatchIdx: 0,
    };
    ctx.reporter.phase('Stream puzzles into PatchDB (fast path)', {
      batchSize: ctx.cli.batchSize,
      paceMs: ctx.cli.paceMs,
      checkpointEvery: ctx.cli.checkpointEvery,
      progressEvery: ctx.cli.progressEvery,
    });
    try {
      await iteratePuzzleRows(
        ctx.resolved,
        (row) => this.#processPuzzleRow({ ctx, rowState, row }),
        this.#iterateProgressOptions(ctx.reporter)
      );
    } finally {
      ctx.reporter.endParseProgressLine();
    }
    await flushPuzzleBatchFast({
      sql: ctx.sql,
      reporter: ctx.reporter,
      state: rowState.state,
    });
    await this.#persistResumeCursor({
      patchDb: ctx.patchDb,
      state: rowState.state,
      sourceEtag: ctx.resolved.etag,
    });
    return rowState.state;
  }

  #maybeReportAlreadyComplete(args: {
    cli: Cli;
    resolved: ResolvedSource;
    prior: PuzzleLoadPriorState;
    reporter: PuzzleSeedReporter;
  }): boolean {
    const { cli, resolved, prior, reporter } = args;
    if (cli.noResume) return false;
    if (prior.finishedAt === null || prior.finishedAt.length === 0)
      return false;
    if (prior.sourceEtag !== resolved.etag) return false;
    reporter.phase('Already complete for this source fingerprint — exiting', {
      etag: resolved.etag,
      finishedAt: prior.finishedAt,
    });
    return true;
  }

  #resolveResumeCursor(args: {
    cli: Cli;
    resolved: ResolvedSource;
    prior: PuzzleLoadPriorState;
    reporter: PuzzleSeedReporter;
  }): string | null {
    const { cli, resolved, prior, reporter } = args;
    const cursor =
      cli.noResume || prior.sourceEtag !== resolved.etag ? null : prior.cursor;
    if (cursor !== null) {
      reporter.phase('Resume from saved cursor', {
        resumeAfterPuzzleId: cursor,
      });
    }
    return cursor;
  }

  async #runSeedInner(args: {
    cli: Cli;
    resolved: ResolvedSource;
    reporter: PuzzleSeedReporter;
    log: Logger;
    sql: SqlClient;
    patchDb: PatchDb;
  }): Promise<void> {
    const { cli, resolved, reporter, log, sql, patchDb } = args;
    const prior = this.#loadStateFromAttrs(
      await this.#readLoadSnapshotAttrs(patchDb)
    );
    if (this.#maybeReportAlreadyComplete({ cli, resolved, prior, reporter }))
      return;
    const resumeCursor = this.#resolveResumeCursor({
      cli,
      resolved,
      prior,
      reporter,
    });
    const stats = await this.#streamPuzzles({
      cli,
      resolved,
      sql,
      patchDb,
      reporter,
      log,
      resumeCursor,
    });
    await patchDb.write(
      [
        this.#loadProgressPatchInput({
          sourceEtag: resolved.etag,
          cursor: stats.lastPuzzleId,
          finishedAt: new Date().toISOString(),
        }),
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    await runFinalMaintenance({
      sql,
      reporter,
      log,
      rebuildIndexes: cli.rebuildIndexes,
    });
    reporter.phase('seed:puzzles: done', {
      processed: stats.processed,
      patchesInserted: stats.patchesInserted,
      snapshotsInserted: stats.snapshotsInserted,
      batchesFlushed: stats.batchesFlushed,
      totalMs: Math.round(performance.now() - stats.startedAt),
      etagPreview:
        resolved.etag.length > 48
          ? `${resolved.etag.slice(0, 48)}…`
          : resolved.etag,
    });
  }

  async #runSeed(
    resolved: ResolvedSource,
    reporter: PuzzleSeedReporter,
    log: Logger
  ): Promise<void> {
    const cli = this.#cli;
    reporter.phase('Connect database (single TCP session)', {
      note: 'Schema (patches/snapshots + pdb_idx_chess_puzzle__*) must already exist; run `bun run --filter @apps/api db:migrate` first on a fresh database.',
    });
    const store = createDopplerSecretStoreForScripts();
    const databaseUrl = (await store.getRequired('DB_URL')).readSecretValue();
    const { sql: sqlClient, client } = this.#createSqlClient(databaseUrl);
    await client.connect();
    try {
      await applySessionTuning(sqlClient, log);
      const patchDb = this.#createSeedPatchDb(sqlClient);
      await this.#runSeedInner({
        cli,
        resolved,
        reporter,
        log,
        sql: sqlClient,
        patchDb,
      });
    } finally {
      await sqlClient.disconnect();
    }
  }
}
