/**
 * Load Lichess puzzle CSV into Postgres (`chess.puzzle` entities) via a
 * tightly-scoped fast-path that bypasses the generic entity store write
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
 * surge that managed Postgres PITR pins as billable storage even after VACUUM.
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
 * and avoids a workspace-level dependency cycle.
 *
 * Connection model: the seed opens **exactly one** TCP session to Postgres
 * via `pg.Client` (not `pg.Pool`). The seed loop is fully serial — one
 * batch transaction at a time with awaited `CHECKPOINT` / `VACUUM` /
 * progress-write statements between batches — so a pool only adds idle
 * connections that count against the host's `max_connections` budget
 * without speeding anything up. PgBouncer-fronted endpoints work too as
 * long as they run in **session pooling** mode (transaction mode breaks
 * `SET …` statements that need to persist across the seed's batches).
 *
 * Dev (secrets env `dev`, hosted dev Postgres):
 *   SECRETS_ENV=dev bun run tools/scripts/secrets-run.ts -- bun run --filter @libs/chess seed:puzzles
 *
 * Production (secrets env `prd`, `DATABASE_URL` → Postgres):
 *   SECRETS_ENV=prd bun run tools/scripts/secrets-run.ts -- bun run --filter @libs/chess seed:puzzles
 *
 * Options: `--profile auto|fast|managed` (default `auto`), `--source`,
 *   `--cache-dir`, `--batch-size`, `--limit`, `--no-resume`, `--dry-run`,
 *   `--pace-ms`, `--checkpoint-every`, `--progress-every`, `--defer-indexes`,
 *   `--no-defer-indexes`, `--rebuild-indexes`, `--json`,
 *   `--pretty` / `--no-pretty` (TTY progress styling).
 * Profiles pick batch size / throttling; explicit flags override the preset.
 */

import { join } from 'node:path';
import { CHESS_PUZZLE_LOAD_ENTITY_ID } from '@libs/chess/shared/chess-puzzle-entities';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import {
  assertDevSecretsEnv,
  PRODUCTION_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assertDatabaseUrlAllowedForSecretsEnvForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { createLogger, type Logger } from '@pkgs/logger';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { openPgClient } from '@pkgs/sql-client/postgres/connect';
import type { Cli } from './cli';
import { parseCli } from './cli';
import { dropPuzzleSnapshotIndexes } from './defer-indexes';
import {
  applySessionTuning,
  createSeedStats,
  flushPuzzleBatchFast,
  runFinalMaintenance,
  runInterimMaintenance,
  type SeedStats,
  sleep,
  writeLoadProgressFast,
} from './fast-path';
import {
  formatProfileLabel,
  type ResolvedSeedProfile,
  resolveSeedProfile,
} from './profile';
import { createPuzzleSeedReporter, type PuzzleSeedReporter } from './reporter';
import { rowToPuzzleBatchEntry } from './row';
import {
  ensureCachedArchive,
  type IteratePuzzleRowsOptions,
  iteratePuzzleRows,
  type ResolvedSource,
} from './streaming';

const REPO_ROOT = join(import.meta.dirname, '../../../../..');

type StreamContext = {
  cli: Cli;
  profile: ResolvedSeedProfile;
  resolved: ResolvedSource;
  db: SqlClient;
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
   *   `pg_stat_activity` and the provider's connection dashboard.
   *
   * Pools (`pg.Pool`) are intentionally not used: the seed loop is fully
   * serial, so a pool only adds idle connections that count against the
   * primary's `max_connections` budget without any throughput benefit.
   */
  async #createSqlClient(databaseUrl: string): Promise<{ db: SqlClient }> {
    const { sqlClient } = await openPgClient({
      connectionString: databaseUrl,
      dbScope: appPostgresDbScope(),
      clientOptions: {
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
        application_name: 'seed:puzzles',
      },
    });
    return { db: sqlClient };
  }

  async #readLoadRow(db: SqlClient): Promise<{
    source_etag: string | null;
    cursor: string | null;
    finished_at: string | null;
  } | null> {
    const rows = await db.query(
      sql<{
        source_etag: string | null;
        cursor: string | null;
        finished_at: string | null;
      }>`
        SELECT source_etag, cursor, finished_at
        FROM chess_puzzle_load
        WHERE id = ${CHESS_PUZZLE_LOAD_ENTITY_ID}
        LIMIT 1
      `
    );
    return rows[0] ?? null;
  }

  #loadStateFromRow(
    row: {
      source_etag: string | null;
      cursor: string | null;
      finished_at: string | null;
    } | null
  ): PuzzleLoadPriorState {
    if (row === null) {
      return { sourceEtag: null, cursor: null, finishedAt: null };
    }
    return {
      sourceEtag: row.source_etag,
      cursor: row.cursor,
      finishedAt: row.finished_at,
    };
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

  async #persistResumeCursor(args: {
    db: SqlClient;
    state: SeedStats;
    sourceEtag: string;
  }): Promise<void> {
    const { db, state, sourceEtag } = args;
    if (state.lastPuzzleId === null) return;
    await writeLoadProgressFast({
      db,
      loadId: CHESS_PUZZLE_LOAD_ENTITY_ID,
      sourceEtag,
      cursor: state.lastPuzzleId,
      finishedAt: null,
    });
  }

  async #resolveArchive(
    log: Logger,
    reporter: PuzzleSeedReporter
  ): Promise<ResolvedSource> {
    const cli = this.#cli;
    reporter.phase('Lichess puzzle seed', {
      source: cli.source,
      cacheDir: cli.cacheDir,
      profile: cli.profile,
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
    if (rowState.state.batch.length < ctx.profile.batchSize) return;
    await flushPuzzleBatchFast({
      db: ctx.db,
      reporter: ctx.reporter,
      state: rowState.state,
    });
    if (
      rowState.state.batchesFlushed - rowState.lastProgressBatchIdx >=
      ctx.profile.progressEvery
    ) {
      await this.#persistResumeCursor({
        db: ctx.db,
        state: rowState.state,
        sourceEtag: ctx.resolved.etag,
      });
      rowState.lastProgressBatchIdx = rowState.state.batchesFlushed;
    }
    if (
      ctx.profile.checkpointEvery > 0 &&
      rowState.state.batchesFlushed % ctx.profile.checkpointEvery === 0
    ) {
      await runInterimMaintenance({
        db: ctx.db,
        reporter: ctx.reporter,
        log: ctx.log,
        state: rowState.state,
        deferIndexes: ctx.profile.deferIndexes,
        checkpointEvery: ctx.profile.checkpointEvery,
      });
    }
    await sleep(ctx.profile.paceMs);
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
    ctx.reporter.phase('Stream puzzles into chess_puzzles (fast path)', {
      profile: formatProfileLabel(this.#cli, ctx.profile),
      batchSize: ctx.profile.batchSize,
      paceMs: ctx.profile.paceMs,
      checkpointEvery: ctx.profile.checkpointEvery,
      progressEvery: ctx.profile.progressEvery,
      deferIndexes: ctx.profile.deferIndexes,
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
      db: ctx.db,
      reporter: ctx.reporter,
      state: rowState.state,
    });
    await this.#persistResumeCursor({
      db: ctx.db,
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
    profile: ResolvedSeedProfile;
    resolved: ResolvedSource;
    reporter: PuzzleSeedReporter;
    log: Logger;
    db: SqlClient;
    prior: PuzzleLoadPriorState;
  }): Promise<void> {
    const { cli, profile, resolved, reporter, log, db, prior } = args;
    const resumeCursor = this.#resolveResumeCursor({
      cli,
      resolved,
      prior,
      reporter,
    });
    const stats = await this.#streamPuzzles({
      cli,
      profile,
      resolved,
      db,
      reporter,
      log,
      resumeCursor,
    });
    await writeLoadProgressFast({
      db,
      loadId: CHESS_PUZZLE_LOAD_ENTITY_ID,
      sourceEtag: resolved.etag,
      cursor: stats.lastPuzzleId,
      finishedAt: new Date().toISOString(),
    });
    await runFinalMaintenance({
      db,
      reporter,
      log,
      rebuildIndexes: profile.rebuildIndexes,
    });
    reporter.phase('seed:puzzles: done', {
      processed: stats.processed,
      rowsInserted: stats.rowsInserted,
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
      note: 'Schema (chess_puzzles + chess_puzzle_load) must already exist; run `bun run --filter @apps/api db:migrate` first on a fresh database.',
    });
    const store = createScriptSecretStore();
    const secretsEnv =
      process.env['SECRETS_ENV']?.trim() || resolveSecretsScope(REPO_ROOT).env;
    if (secretsEnv !== PRODUCTION_SECRETS_ENV) {
      assertDevSecretsEnv(secretsEnv);
    }
    const databaseUrl = (
      await store.getRequired('DATABASE_URL')
    ).readSecretValue();
    await assertDatabaseUrlAllowedForSecretsEnvForTooling(
      databaseUrl,
      secretsEnv,
      {
        surface: 'chess:seed-puzzles',
      }
    );
    const { db: sqlClient } = await this.#createSqlClient(databaseUrl);
    try {
      const managed = await applySessionTuning(sqlClient, log);
      const profile = resolveSeedProfile({ cli, managed });
      reporter.phase('Seed profile resolved', {
        profile: formatProfileLabel(cli, profile),
        managedDetected: profile.managedDetected,
        batchSize: profile.batchSize,
        paceMs: profile.paceMs,
        checkpointEvery: profile.checkpointEvery,
        progressEvery: profile.progressEvery,
        deferIndexes: profile.deferIndexes,
        rebuildIndexes: profile.rebuildIndexes,
      });
      const prior = this.#loadStateFromRow(await this.#readLoadRow(sqlClient));
      if (
        this.#maybeReportAlreadyComplete({ cli, resolved, prior, reporter })
      ) {
        return;
      }
      if (profile.deferIndexes) {
        await dropPuzzleSnapshotIndexes({ db: sqlClient, log });
      }
      await this.#runSeedInner({
        cli,
        profile,
        resolved,
        reporter,
        log,
        db: sqlClient,
        prior,
      });
    } finally {
      await sqlClient.disconnect();
    }
  }
}
