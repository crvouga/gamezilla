/**
 * In-process better-sqlite3 for product UI simulations (portable SQL path).
 *
 * Migrated schema is cached as an on-disk seed file
 * (`test/ui/.cache/sim-backend-seed.sqlite`). Each Simulation.open clones that
 * seed into `:memory:` (or restores the shared process handle) instead of
 * re-running migrations.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import type { Sql } from '@pkgs/sql';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
import type { PreparedStatement, SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';

/** Placeholder URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

/** Bump when seed format / restore semantics change outside migrate source. */
export const SIM_SEED_VERSION = 1;

const CACHE_DIR = join(__dirname, '../../.cache');
export const SIM_SEED_SQLITE_PATH = join(CACHE_DIR, 'sim-backend-seed.sqlite');
export const SIM_SEED_FINGERPRINT_PATH = join(
  CACHE_DIR,
  'sim-backend-seed.fingerprint'
);

const MIGRATE_SOURCE_PATH = join(__dirname, 'migrate-sim-sqlite.ts');

export type SimSqliteHandle = {
  readonly sqlClient: SqlClient;
  readonly sqlite: BetterSqlite3.Database;
  readonly openRequestDb: OpenRequestDb;
  /** Reset shared DB to the post-migrate seed snapshot. */
  stop(): Promise<void>;
};

type LiveRefs = {
  sqlClient: SqlClient;
  sqlite: BetterSqlite3.Database;
};

type ProcessSeedCache = {
  readonly seedBuffer: Buffer;
  readonly fingerprint: string;
  readonly refs: LiveRefs;
  readonly openRequestDb: OpenRequestDb;
};

let processCache: ProcessSeedCache | null = null;

/** Serialize writes — better-sqlite3 forbids nested BEGIN under overlap. */
function createSerialSqlClient(inner: SqlClient): SqlClient {
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
  return {
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    query: (q) => inner.query(q),
    run: (q) => enqueue(() => inner.run(q)),
    prepare: <T extends Record<string, unknown>>(query: Sql<T>) => {
      const prepared = inner.prepare(query);
      const serial: PreparedStatement<T> = {
        query: (params) => prepared.query(params),
        run: (params) => enqueue(() => prepared.run(params)),
      };
      return serial;
    },
    transaction: (fn) => enqueue(() => inner.transaction(fn)),
  };
}

function sharedRequestSqlClient(getRefs: () => LiveRefs): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => getRefs().sqlClient.query(query),
    run: (query) => getRefs().sqlClient.run(query),
    prepare: (query) => getRefs().sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      getRefs().sqlClient.transaction(fn),
  };
}

function openMemoryFromBuffer(seedBuffer: Buffer): LiveRefs {
  const sqlite = new BetterSqlite3(seedBuffer);
  const base = new SqlClientImplBetterSqlite(sqlite);
  const sqlClient = new SqlClientImplAgnostic(createSerialSqlClient(base));
  return { sqlClient, sqlite };
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export function computeSimSeedFingerprint(): string {
  const migrateSource = readFileSync(MIGRATE_SOURCE_PATH);
  return createHash('sha256')
    .update(`v${String(SIM_SEED_VERSION)}\n`)
    .update(migrateSource)
    .digest('hex');
}

function readCachedFingerprint(): string | null {
  if (!existsSync(SIM_SEED_FINGERPRINT_PATH)) return null;
  if (!existsSync(SIM_SEED_SQLITE_PATH)) return null;
  return readFileSync(SIM_SEED_FINGERPRINT_PATH, 'utf8').trim();
}

function writeSeedArtifacts(seedBuffer: Buffer, fingerprint: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const tmpPath = `${SIM_SEED_SQLITE_PATH}.${String(process.pid)}.tmp`;
  try {
    writeFileSync(tmpPath, seedBuffer);
    renameSync(tmpPath, SIM_SEED_SQLITE_PATH);
    writeFileSync(SIM_SEED_FINGERPRINT_PATH, `${fingerprint}\n`, 'utf8');
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup
    }
    throw err;
  }
}

/**
 * Ensure on-disk seed matches fingerprint. Rebuilds via `migrate` when missing
 * or stale. Returns the seed bytes and whether migrate ran.
 */
export async function ensureSimSeedBuffer(args: {
  readonly migrate: (handle: {
    readonly sqlClient: SqlClient;
    readonly sqlite: BetterSqlite3.Database;
  }) => Promise<void>;
}): Promise<{ readonly seedBuffer: Buffer; readonly didMigrate: boolean }> {
  const fingerprint = computeSimSeedFingerprint();
  const cached = readCachedFingerprint();
  if (cached === fingerprint) {
    return {
      seedBuffer: readFileSync(SIM_SEED_SQLITE_PATH),
      didMigrate: false,
    };
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const buildPath = join(
    CACHE_DIR,
    `sim-backend-seed.build.${String(process.pid)}.sqlite`
  );
  try {
    if (existsSync(buildPath)) unlinkSync(buildPath);
    const fileDb = new BetterSqlite3(buildPath);
    // Migrate uses the raw engine client — schema reconcile needs PRAGMA /
    // vendor bootstrap SQL that SqlClientImplAgnostic correctly bans at runtime.
    const base = new SqlClientImplBetterSqlite(fileDb);
    await base.connect();
    const sqlClient = createSerialSqlClient(base);
    await args.migrate({ sqlClient, sqlite: fileDb });
    const seedBuffer = fileDb.serialize();
    fileDb.close();
    writeSeedArtifacts(seedBuffer, fingerprint);
    return { seedBuffer, didMigrate: true };
  } finally {
    try {
      if (existsSync(buildPath)) unlinkSync(buildPath);
    } catch {
      // ignore
    }
  }
}

function installProcessCache(
  seedBuffer: Buffer,
  fingerprint: string
): ProcessSeedCache {
  const refs = openMemoryFromBuffer(seedBuffer);
  const getRefs = (): LiveRefs => {
    const cache = processCache;
    if (cache === null) {
      throw new Error('sim sqlite process cache missing');
    }
    return cache.refs;
  };
  const openRequestDb: OpenRequestDb = async () => ({
    kind: 'sqlite',
    sqlClient: sharedRequestSqlClient(getRefs),
    sqlite: getRefs().sqlite,
  });
  const cache: ProcessSeedCache = {
    seedBuffer,
    fingerprint,
    refs,
    openRequestDb,
  };
  processCache = cache;
  return cache;
}

function restoreProcessCacheFromSeed(): void {
  const cache = processCache;
  if (cache === null) {
    throw new Error('sim sqlite process cache missing');
  }
  try {
    cache.refs.sqlite.close();
  } catch {
    // already closed
  }
  const next = openMemoryFromBuffer(cache.seedBuffer);
  cache.refs.sqlClient = next.sqlClient;
  cache.refs.sqlite = next.sqlite;
}

/**
 * Boots shared in-memory SQLite from the seed file (rebuilds seed when stale).
 * `stop()` restores the post-migrate snapshot for the next Simulation.open.
 */
export async function bootMigratedSimSqlite(args: {
  readonly migrate: (handle: {
    readonly sqlClient: SqlClient;
    readonly sqlite: BetterSqlite3.Database;
  }) => Promise<void>;
}): Promise<{
  readonly handle: SimSqliteHandle;
  readonly didMigrate: boolean;
}> {
  const fingerprint = computeSimSeedFingerprint();

  if (processCache !== null && processCache.fingerprint === fingerprint) {
    restoreProcessCacheFromSeed();
    const cache = processCache;
    return {
      handle: {
        get sqlClient() {
          return cache.refs.sqlClient;
        },
        get sqlite() {
          return cache.refs.sqlite;
        },
        openRequestDb: cache.openRequestDb,
        stop: async () => {
          restoreProcessCacheFromSeed();
        },
      },
      didMigrate: false,
    };
  }

  const { seedBuffer, didMigrate } = await ensureSimSeedBuffer({
    migrate: args.migrate,
  });
  const cache = installProcessCache(seedBuffer, fingerprint);

  return {
    handle: {
      get sqlClient() {
        return cache.refs.sqlClient;
      },
      get sqlite() {
        return cache.refs.sqlite;
      },
      openRequestDb: cache.openRequestDb,
      stop: async () => {
        restoreProcessCacheFromSeed();
      },
    },
    didMigrate,
  };
}
