/**
 * Load Lichess puzzle CSV into PatchDB (`chess.puzzle` entities) via the normal
 * write path (patches → snapshots). Idempotent: content-addressed `patchId`
 * per row; `INSERT … ON CONFLICT DO NOTHING` skips unchanged rows.
 *
 * Local (Doppler `local`, `DB_URL` → PGlite socket or other Postgres):
 *   DOPPLER_CONFIG=local doppler run -- bun run --filter @gamezilla/api seed:puzzles
 *
 * Production (Doppler `prod`, `DB_URL` → Postgres):
 *   DOPPLER_CONFIG=prod doppler run -- bun run --filter @gamezilla/api seed:puzzles
 *
 * Options: `--source`, `--cache-dir`, `--batch-size`, `--limit`, `--no-resume`, `--dry-run`,
 * `--json` (one JSON log line per event), `--pretty` / `--no-pretty` (TTY progress styling).
 * Default: colored progress on stderr when stderr is a TTY and `CI` is unset.
 */

import {
  CHESS_PUZZLE_ENTITY_TYPE,
  CHESS_PUZZLE_LOAD_ENTITY_ID,
  CHESS_PUZZLE_LOAD_ENTITY_TYPE,
  ChessPuzzleAttr,
  ChessPuzzleLoadAttr,
} from '@gamezilla/chess/shared/chess-puzzle-entities';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import { SqlClientImplPg } from '@gamezilla/lib/sql-client/impl-pg';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import {
  PATCHES_DB_SYSTEM_CONTEXT,
  type PatchDb,
  type PatchInput,
} from '@gamezilla/patch-db/interface';
import { PatchDbCompactionPolicyRegistry } from '@gamezilla/patch-db/policy/compaction-policy';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { loadBetterAuthOptionsForMigration } from '@gamezilla/auth/server/better-auth-doppler-options';
import { runPostgresMigrations } from '@gamezilla/api/migrations/run-postgres-migrations';
import {
  createPuzzleSeedReporter,
  type PuzzleSeedReporter,
} from './seed-chess-puzzles-reporter';
import {
  ensureCachedArchive,
  iteratePuzzleRows,
  type IteratePuzzleRowsOptions,
  type ResolvedSource,
} from './seed-chess-puzzles-streaming';

const DEFAULT_PUZZLE_URL =
  'https://database.lichess.org/lichess_db_puzzle.csv.zst';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FEATURE_CHESS_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CACHE_DIR = join(FEATURE_CHESS_ROOT, '.cache', 'lichess');

function createSqlClient(databaseUrl: string): {
  sql: SqlClient;
  pool: Pool;
} {
  const pool = new Pool({ connectionString: databaseUrl });
  return { sql: new SqlClientImplPg(pool), pool };
}

function createSeedPatchDb(sql: SqlClient): PatchDb {
  const compaction = new PatchDbCompactionPolicyRegistry();
  compaction.registerAll({
    [CHESS_PUZZLE_ENTITY_TYPE]: { keepLatest: 1 },
    [CHESS_PUZZLE_LOAD_ENTITY_TYPE]: { keepLatest: 1 },
  });
  // `autoCompactOnWrite: false`: each puzzle's `patchId` is content-addressed
  // and `INSERT … ON CONFLICT DO NOTHING` keeps it at exactly one patch per
  // entity, so post-write compaction is always a no-op for this seed. The
  // post-write check still fires one `SELECT_PATCHES_FOR_SNAPSHOT` per
  // touched entity though — a 5k-row batch turned into ~5k extra
  // serverless HTTP round-trips, which contributed to gateway resets
  // (`ECONNRESET` from Neon HTTP) under steady seeding load. The
  // `compactionPolicy` is left wired so an explicit `compaction.compactAll`
  // pass remains available if a future seed ever needs it.
  return new PatchDbImplPostgres(sql, {
    autoCompactOnWrite: false,
    compactionPolicy: compaction.resolve,
  });
}

type Cli = {
  source: string;
  cacheDir: string;
  batchSize: number;
  limit: number | null;
  noResume: boolean;
  dryRun: boolean;
  /** Colored stderr progress + concise phases (vs JSON lines). */
  prettyOutput: boolean;
};

function parseCli(argv: string[]): Cli {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string' },
      'cache-dir': { type: 'string' },
      'batch-size': { type: 'string' },
      limit: { type: 'string' },
      'no-resume': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      pretty: { type: 'boolean', default: false },
      'no-pretty': { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: false,
  });

  const batchSizeOpt = values['batch-size'];
  const batchRaw = typeof batchSizeOpt === 'string' ? batchSizeOpt.trim() : '';
  const batchSize =
    batchRaw === '' ? 5000 : Math.max(1, Number.parseInt(batchRaw, 10));
  if (!Number.isFinite(batchSize)) {
    throw new Error(`Invalid --batch-size: ${String(batchSizeOpt)}`);
  }

  const limitOpt = values.limit;
  const limitRaw = typeof limitOpt === 'string' ? limitOpt.trim() : '';
  const limit =
    limitRaw === ''
      ? null
      : (() => {
          const n = Number.parseInt(limitRaw, 10);
          if (!Number.isFinite(n) || n < 1) {
            throw new Error(`Invalid --limit: ${String(limitOpt)}`);
          }
          return n;
        })();

  const jsonLogs = values.json === true;
  const stderr = process.stderr as NodeJS.WriteStream & { isTTY?: boolean };
  const ttyPretty =
    stderr.isTTY === true &&
    process.env['CI'] !== 'true' &&
    process.env['CI'] !== '1';
  let prettyOutput = false;
  if (jsonLogs) prettyOutput = false;
  else if (values['no-pretty'] === true) prettyOutput = false;
  else if (values.pretty === true) prettyOutput = true;
  else prettyOutput = ttyPretty;

  return {
    source:
      (typeof values.source === 'string' ? values.source.trim() : '') ||
      DEFAULT_PUZZLE_URL,
    cacheDir:
      (typeof values['cache-dir'] === 'string'
        ? values['cache-dir'].trim()
        : '') || DEFAULT_CACHE_DIR,
    batchSize,
    limit,
    noResume: values['no-resume'] === true,
    dryRun: values['dry-run'] === true,
    prettyOutput,
  };
}

function iterateProgressOptions(
  reporter: ReturnType<typeof createPuzzleSeedReporter>
): IteratePuzzleRowsOptions {
  return {
    onParsedRowCount: ({ parsedRows }) => {
      reporter.parseProgress(parsedRows);
    },
    progressEveryDataRows: 25_000,
  };
}

function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) {
    sorted[k] = obj[k];
  }
  return JSON.stringify(sorted);
}

function contentAddressedPatchId(attrs: Record<string, unknown>): string {
  return createHash('sha256')
    .update(canonicalJson(attrs), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

function splitSpaceSorted(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b));
}

function rowToPuzzleAttributes(
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const puzzleId = String(row['PuzzleId'] ?? '').trim();
  if (puzzleId.length === 0) return null;
  const fen = String(row['FEN'] ?? '').trim();
  const moves = String(row['Moves'] ?? '').trim();
  if (fen.length === 0 || moves.length === 0) return null;

  const rating = Number.parseInt(String(row['Rating'] ?? ''), 10);
  const ratingDeviation = Number.parseInt(
    String(row['RatingDeviation'] ?? ''),
    10
  );
  const popularity = Number.parseInt(String(row['Popularity'] ?? ''), 10);
  const nbPlays = Number.parseInt(String(row['NbPlays'] ?? ''), 10);

  const gameUrlRaw = row['GameUrl'];
  const gameUrl =
    typeof gameUrlRaw === 'string' && gameUrlRaw.trim().length > 0
      ? gameUrlRaw.trim()
      : null;

  return {
    [ChessPuzzleAttr.id.key]: puzzleId,
    [ChessPuzzleAttr.fen.key]: fen,
    [ChessPuzzleAttr.moves.key]: moves,
    [ChessPuzzleAttr.rating.key]: Number.isFinite(rating) ? rating : 0,
    [ChessPuzzleAttr.ratingDeviation.key]: Number.isFinite(ratingDeviation)
      ? ratingDeviation
      : 0,
    [ChessPuzzleAttr.popularity.key]: Number.isFinite(popularity)
      ? popularity
      : 0,
    [ChessPuzzleAttr.nbPlays.key]: Number.isFinite(nbPlays) ? nbPlays : 0,
    [ChessPuzzleAttr.themes.key]: splitSpaceSorted(row['Themes']),
    [ChessPuzzleAttr.gameUrl.key]: gameUrl,
    [ChessPuzzleAttr.openingTags.key]: splitSpaceSorted(row['OpeningTags']),
  };
}

function rowToPatch(row: Record<string, unknown>): PatchInput | null {
  const attributes = rowToPuzzleAttributes(row);
  if (attributes === null) return null;
  const puzzleId = String(attributes[ChessPuzzleAttr.id.key]);
  const patchId = contentAddressedPatchId(attributes);
  return {
    entityId: puzzleId,
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    patchId,
    parentId: null,
    attributes: attributes as PatchInput['attributes'],
  };
}

async function readLoadSnapshotAttrs(
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

function loadStateFromAttrs(attrs: Record<string, unknown> | null): {
  sourceEtag: string | null;
  cursor: string | null;
  finishedAt: string | null;
} {
  if (attrs === null) {
    return { sourceEtag: null, cursor: null, finishedAt: null };
  }
  return {
    sourceEtag: ChessPuzzleLoadAttr.sourceEtag.from(attrs),
    cursor: ChessPuzzleLoadAttr.cursor.from(attrs),
    finishedAt: ChessPuzzleLoadAttr.finishedAt.from(attrs),
  };
}

function loadProgressPatchInput(args: {
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

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const log = createLogger({ name: 'db:seed-puzzles' });
  const reporter = createPuzzleSeedReporter({
    pretty: cli.prettyOutput,
    logger: log,
  });
  const resolved = await resolveArchive(cli, log, reporter);
  if (cli.dryRun) {
    await runDryRun(cli, resolved, reporter);
    return;
  }
  await runSeed(cli, resolved, reporter, log);
}

async function resolveArchive(
  cli: Cli,
  log: ReturnType<typeof createLogger>,
  reporter: PuzzleSeedReporter
): Promise<ResolvedSource> {
  reporter.phase('Lichess puzzle seed', {
    source: cli.source,
    cacheDir: cli.cacheDir,
    batchSize: cli.batchSize,
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

async function runDryRun(
  cli: Cli,
  resolved: ResolvedSource,
  reporter: PuzzleSeedReporter
): Promise<void> {
  reporter.phase('Dry run — parse CSV only (no database writes)', {
    path: resolved.localPath,
  });
  let n = 0;
  try {
    await iteratePuzzleRows(
      resolved,
      async (row) => {
        if (rowToPatch(row) === null) return true;
        n += 1;
        return cli.limit === null || n < cli.limit;
      },
      iterateProgressOptions(reporter)
    );
  } finally {
    reporter.endParseProgressLine();
  }
  reporter.phase('Dry run complete', { validPuzzleRowsSeen: n });
}

type SeedStats = {
  processed: number;
  written: number;
  lastPuzzleId: string | null;
  startedAt: number;
  batch: PatchInput[];
};

async function flushPuzzleBatch(args: {
  patchDb: PatchDb;
  reporter: PuzzleSeedReporter;
  state: SeedStats;
  sourceEtag: string;
}): Promise<void> {
  const { patchDb, reporter, state, sourceEtag } = args;
  if (state.batch.length === 0) return;
  const chunkStart = performance.now();
  const resWrite = await patchDb.write(state.batch, PATCHES_DB_SYSTEM_CONTEXT);
  state.written += resWrite.accepted.length;
  state.batch.length = 0;
  if (state.lastPuzzleId !== null) {
    await patchDb.write(
      [
        loadProgressPatchInput({
          sourceEtag,
          cursor: state.lastPuzzleId,
          finishedAt: null,
        }),
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
  }
  reporter.batchSummary('seed:puzzles: batch', {
    processed: state.processed,
    written: state.written,
    batchMs: Math.round(performance.now() - chunkStart),
    lastPuzzleId: state.lastPuzzleId,
  });
}

async function streamPuzzles(args: {
  cli: Cli;
  resolved: ResolvedSource;
  patchDb: PatchDb;
  reporter: PuzzleSeedReporter;
  resumeCursor: string | null;
}): Promise<SeedStats> {
  const state: SeedStats = {
    processed: 0,
    written: 0,
    lastPuzzleId: args.resumeCursor,
    startedAt: performance.now(),
    batch: [],
  };
  const { cli, resolved, patchDb, reporter, resumeCursor } = args;
  reporter.phase('Stream puzzles into PatchDB', { batchSize: cli.batchSize });
  try {
    await iteratePuzzleRows(
      resolved,
      async (row) => {
        if (resumeCursor !== null) {
          const id = String(row['PuzzleId'] ?? '').trim();
          if (id.length > 0 && id.localeCompare(resumeCursor) <= 0) return true;
        }
        const patch = rowToPatch(row);
        if (patch === null) return true;
        state.batch.push(patch);
        state.processed += 1;
        state.lastPuzzleId = String(patch.attributes[ChessPuzzleAttr.id.key]);
        if (state.batch.length >= cli.batchSize) {
          await flushPuzzleBatch({
            patchDb,
            reporter,
            state,
            sourceEtag: resolved.etag,
          });
        }
        return cli.limit === null || state.processed < cli.limit;
      },
      iterateProgressOptions(reporter)
    );
  } finally {
    reporter.endParseProgressLine();
  }
  await flushPuzzleBatch({
    patchDb,
    reporter,
    state,
    sourceEtag: resolved.etag,
  });
  return state;
}

async function runSeed(
  cli: Cli,
  resolved: ResolvedSource,
  reporter: PuzzleSeedReporter,
  log: ReturnType<typeof createLogger>
): Promise<void> {
  reporter.phase('Connect database & run migrations');
  const store = createDopplerSecretStoreForScripts();
  const databaseUrl = await store.getRequired('DB_URL');
  const { sql: sqlClient, pool } = createSqlClient(databaseUrl);
  await sqlClient.connect();
  try {
    await runPostgresMigrations({
      sqlClient,
      databaseUrl,
      logger: log,
      betterAuthOptions: await loadBetterAuthOptionsForMigration(store),
    });
    const patchDb = createSeedPatchDb(sqlClient);
    const prior = loadStateFromAttrs(await readLoadSnapshotAttrs(patchDb));
    if (
      !cli.noResume &&
      prior.finishedAt !== null &&
      prior.finishedAt.length > 0 &&
      prior.sourceEtag === resolved.etag
    ) {
      reporter.phase('Already complete for this source fingerprint — exiting', {
        etag: resolved.etag,
        finishedAt: prior.finishedAt,
      });
      return;
    }
    const resumeCursor =
      cli.noResume || prior.sourceEtag !== resolved.etag ? null : prior.cursor;
    if (resumeCursor !== null) {
      reporter.phase('Resume from saved cursor', {
        resumeAfterPuzzleId: resumeCursor,
      });
    }
    const stats = await streamPuzzles({
      cli,
      resolved,
      patchDb,
      reporter,
      resumeCursor,
    });
    await patchDb.write(
      [
        loadProgressPatchInput({
          sourceEtag: resolved.etag,
          cursor: stats.lastPuzzleId,
          finishedAt: new Date().toISOString(),
        }),
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    reporter.phase('seed:puzzles: done', {
      processed: stats.processed,
      written: stats.written,
      totalMs: Math.round(performance.now() - stats.startedAt),
      etagPreview:
        resolved.etag.length > 48
          ? `${resolved.etag.slice(0, 48)}…`
          : resolved.etag,
    });
  } finally {
    await pool.end();
  }
}

await main().catch((error: unknown) => {
  assert.fail('seed:puzzles failed', { error });
});
