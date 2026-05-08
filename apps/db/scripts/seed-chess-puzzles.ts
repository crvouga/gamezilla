/**
 * Load Lichess puzzle CSV into PatchDB (`chess.puzzle` entities) via the normal
 * write path (patches → snapshots). Idempotent: content-addressed `patchId`
 * per row; `INSERT … ON CONFLICT DO NOTHING` skips unchanged rows.
 *
 * Local (Doppler `local`, `DB_URL` → PGlite HTTP):
 *   DOPPLER_CONFIG=local doppler run -- bun run --filter @gamezilla/db seed:puzzles
 *
 * Production (Doppler `prod`, `DB_URL` → Postgres):
 *   DOPPLER_CONFIG=prod doppler run -- bun run --filter @gamezilla/db seed:puzzles
 *
 * Options: `--source`, `--cache-dir`, `--batch-size`, `--limit`, `--no-resume`, `--dry-run`
 * (see `parseCli()`).
 */

import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  CHESS_PUZZLE_LOAD_ENTITY_ID,
  CHESS_PUZZLE_LOAD_ENTITY_TYPE,
  ChessPuzzleAttr,
  ChessPuzzleLoadAttr,
} from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-entities';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import {
  PATCHES_DB_SYSTEM_CONTEXT,
  type PatchDb,
  type PatchInput,
} from '@gamezilla/patch-db/interface';
import { PatchDbCompactionPolicyRegistry } from '@gamezilla/patch-db/policy/compaction-policy';
import { runPostgresMigrations } from '../src/postgres-migrations';
import {
  ensureCachedArchive,
  iteratePuzzleRows,
} from './seed-chess-puzzles-streaming.ts';

const DEFAULT_PUZZLE_URL =
  'https://database.lichess.org/lichess_db_puzzle.csv.zst';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DB_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CACHE_DIR = join(APP_DB_ROOT, '.cache', 'lichess');

function createSqlClient(databaseUrl: string): SqlClient {
  return databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
}

function createSeedPatchDb(sql: SqlClient): PatchDb {
  const compaction = new PatchDbCompactionPolicyRegistry();
  compaction.registerAll({
    [CHESS_PUZZLE_ENTITY_TYPE]: { keepLatest: 1 },
    [CHESS_PUZZLE_LOAD_ENTITY_TYPE]: { keepLatest: 1 },
  });
  return new PatchDbImplPostgres(sql, {
    autoCompactOnWrite: true,
    compactionPolicy: compaction.resolve,
  });
}

async function resolveDatabaseUrlFromDoppler(): Promise<string> {
  const store = createDopplerSecretStoreForScripts();
  return store.getRequired('DB_URL');
}

type Cli = {
  source: string;
  cacheDir: string;
  batchSize: number;
  limit: number | null;
  noResume: boolean;
  dryRun: boolean;
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

  const resolved = await ensureCachedArchive({
    source: cli.source,
    cacheDir: cli.cacheDir,
    log,
  });

  if (cli.dryRun) {
    log.info('seed:puzzles: dry-run (parse only, no database)', {
      path: resolved.localPath,
    });
    let n = 0;
    await iteratePuzzleRows(resolved, async (row) => {
      if (rowToPatch(row) === null) return true;
      n += 1;
      return cli.limit === null || n < cli.limit;
    });
    log.info('seed:puzzles: dry-run complete', { rowsSeen: n });
    return;
  }

  const databaseUrl = await resolveDatabaseUrlFromDoppler();
  const sqlClient = createSqlClient(databaseUrl);
  await sqlClient.connect();
  try {
    await runPostgresMigrations({ sqlClient, logger: log });
    const patchDb = createSeedPatchDb(sqlClient);

    const priorAttrs = await readLoadSnapshotAttrs(patchDb);
    const prior = loadStateFromAttrs(priorAttrs);
    if (
      !cli.noResume &&
      prior.finishedAt !== null &&
      prior.finishedAt.length > 0 &&
      prior.sourceEtag === resolved.etag
    ) {
      log.info('seed:puzzles: already complete for this source fingerprint', {
        etag: resolved.etag,
        finishedAt: prior.finishedAt,
      });
      return;
    }

    const resumeCursor =
      cli.noResume || prior.sourceEtag !== resolved.etag ? null : prior.cursor;

    let processed = 0;
    let written = 0;
    let lastPuzzleId: string | null = resumeCursor;
    const batch: PatchInput[] = [];
    const t0 = performance.now();

    const flushPuzzleBatch = async (): Promise<void> => {
      if (batch.length === 0) return;
      const chunkStart = performance.now();
      const resWrite = await patchDb.write(batch, PATCHES_DB_SYSTEM_CONTEXT);
      written += resWrite.accepted.length;
      batch.length = 0;
      if (lastPuzzleId !== null) {
        await patchDb.write(
          [
            loadProgressPatchInput({
              sourceEtag: resolved.etag,
              cursor: lastPuzzleId,
              finishedAt: null,
            }),
          ],
          PATCHES_DB_SYSTEM_CONTEXT
        );
      }
      const ms = Math.round(performance.now() - chunkStart);
      log.info('seed:puzzles: batch', {
        processed,
        written,
        batchMs: ms,
        lastPuzzleId,
      });
    };

    await iteratePuzzleRows(resolved, async (row) => {
      if (resumeCursor !== null) {
        const id = String(row['PuzzleId'] ?? '').trim();
        if (id.length > 0 && id.localeCompare(resumeCursor) <= 0) {
          return true;
        }
      }
      const patch = rowToPatch(row);
      if (patch === null) return true;
      batch.push(patch);
      processed += 1;
      lastPuzzleId = String(patch.attributes[ChessPuzzleAttr.id.key]);
      if (batch.length >= cli.batchSize) {
        await flushPuzzleBatch();
      }
      return cli.limit === null || processed < cli.limit;
    });

    await flushPuzzleBatch();

    await patchDb.write(
      [
        loadProgressPatchInput({
          sourceEtag: resolved.etag,
          cursor: lastPuzzleId,
          finishedAt: new Date().toISOString(),
        }),
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );

    log.info('seed:puzzles: done', {
      processed,
      written,
      totalMs: Math.round(performance.now() - t0),
      etag: resolved.etag,
    });
  } finally {
    await sqlClient.disconnect();
  }
}

await main().catch((error: unknown) => {
  assert.fail('seed:puzzles failed', { error });
});
