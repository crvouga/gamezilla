/**
 * Seeded better-sqlite3 boot for in-process simulations.
 *
 * Migrated schema is cached as an on-disk seed file. Each open clones that seed
 * into `:memory:` (or restores the shared process handle) instead of re-running
 * migrations. Product code injects `migrate` + fingerprint inputs — this module
 * stays app-agnostic.
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
import type { Sql } from '@pkgs/sql';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
import type { PreparedStatement, SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBetterSqlite } from '@pkgs/sql-client/sqlite/impl-better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';

/** Bump when seed format / restore semantics change outside migrate source. */
export const SIM_SQLITE_SEED_VERSION = 1;

export type SimSqliteLiveRefs = {
  sqlClient: SqlClient;
  sqlite: BetterSqlite3.Database;
};

export type SimSqliteHandle = {
  readonly sqlClient: SqlClient;
  readonly sqlite: BetterSqlite3.Database;
  /** Reset shared DB to the post-migrate seed snapshot. */
  stop(): Promise<void>;
};

export type SimSqliteMigrateHandle = {
  readonly sqlClient: SqlClient;
  readonly sqlite: BetterSqlite3.Database;
};

export type BootMigratedSimSqliteArgs = {
  /** Directory for seed file + fingerprint (created if missing). */
  readonly cacheDir: string;
  /** Seed filename inside `cacheDir` (default `sim-backend-seed.sqlite`). */
  readonly seedFileName?: string;
  /** Extra fingerprint bytes (e.g. migrate composer source). */
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
  readonly migrate: (handle: SimSqliteMigrateHandle) => Promise<void>;
};

type ProcessSeedCache = {
  readonly seedBuffer: Buffer;
  readonly fingerprint: string;
  readonly refs: SimSqliteLiveRefs;
};

const processCaches = new Map<string, ProcessSeedCache>();

/** Serialize writes — better-sqlite3 forbids nested BEGIN under overlap. */
export function createSerialSqlClient(inner: SqlClient): SqlClient {
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

function openMemoryFromBuffer(seedBuffer: Buffer): SimSqliteLiveRefs {
  const sqlite = new BetterSqlite3(seedBuffer);
  const base = new SqlClientImplBetterSqlite(sqlite);
  const sqlClient = new SqlClientImplAgnostic(createSerialSqlClient(base));
  return { sqlClient, sqlite };
}

function seedPaths(cacheDir: string, seedFileName: string) {
  return {
    seedPath: join(cacheDir, seedFileName),
    fingerprintPath: join(cacheDir, `${seedFileName}.fingerprint`),
  };
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export function computeSimSqliteSeedFingerprint(args: {
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
}): string {
  const version = args.seedVersion ?? SIM_SQLITE_SEED_VERSION;
  const source =
    typeof args.fingerprintSource === 'string'
      ? Buffer.from(args.fingerprintSource)
      : args.fingerprintSource;
  return createHash('sha256')
    .update(`v${String(version)}\n`)
    .update(source)
    .digest('hex');
}

function readCachedFingerprint(fingerprintPath: string, seedPath: string) {
  if (!existsSync(fingerprintPath)) return null;
  if (!existsSync(seedPath)) return null;
  return readFileSync(fingerprintPath, 'utf8').trim();
}

function writeSeedArtifacts(args: {
  readonly cacheDir: string;
  readonly seedPath: string;
  readonly fingerprintPath: string;
  readonly seedBuffer: Buffer;
  readonly fingerprint: string;
}): void {
  mkdirSync(args.cacheDir, { recursive: true });
  const tmpPath = `${args.seedPath}.${String(process.pid)}.tmp`;
  try {
    writeFileSync(tmpPath, args.seedBuffer);
    renameSync(tmpPath, args.seedPath);
    writeFileSync(args.fingerprintPath, `${args.fingerprint}\n`, 'utf8');
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
export async function ensureSimSqliteSeedBuffer(
  args: BootMigratedSimSqliteArgs
): Promise<{ readonly seedBuffer: Buffer; readonly didMigrate: boolean }> {
  const seedFileName = args.seedFileName ?? 'sim-backend-seed.sqlite';
  const { seedPath, fingerprintPath } = seedPaths(args.cacheDir, seedFileName);
  const fingerprint = computeSimSqliteSeedFingerprint({
    fingerprintSource: args.fingerprintSource,
    ...(args.seedVersion !== undefined
      ? { seedVersion: args.seedVersion }
      : {}),
  });
  const cached = readCachedFingerprint(fingerprintPath, seedPath);
  if (cached === fingerprint) {
    return {
      seedBuffer: readFileSync(seedPath),
      didMigrate: false,
    };
  }

  mkdirSync(args.cacheDir, { recursive: true });
  const buildPath = join(
    args.cacheDir,
    `${seedFileName}.build.${String(process.pid)}.sqlite`
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
    writeSeedArtifacts({
      cacheDir: args.cacheDir,
      seedPath,
      fingerprintPath,
      seedBuffer,
      fingerprint,
    });
    return { seedBuffer, didMigrate: true };
  } finally {
    try {
      if (existsSync(buildPath)) unlinkSync(buildPath);
    } catch {
      // ignore
    }
  }
}

function cacheKey(cacheDir: string, seedFileName: string, fingerprint: string) {
  return `${cacheDir}\0${seedFileName}\0${fingerprint}`;
}

function installProcessCache(
  key: string,
  seedBuffer: Buffer,
  fingerprint: string
): ProcessSeedCache {
  const refs = openMemoryFromBuffer(seedBuffer);
  const cache: ProcessSeedCache = {
    seedBuffer,
    fingerprint,
    refs,
  };
  processCaches.set(key, cache);
  return cache;
}

function restoreProcessCacheFromSeed(key: string): void {
  const cache = processCaches.get(key);
  if (cache === undefined) {
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
export async function bootMigratedSimSqlite(
  args: BootMigratedSimSqliteArgs
): Promise<{
  readonly handle: SimSqliteHandle;
  readonly didMigrate: boolean;
}> {
  const seedFileName = args.seedFileName ?? 'sim-backend-seed.sqlite';
  const fingerprint = computeSimSqliteSeedFingerprint({
    fingerprintSource: args.fingerprintSource,
    ...(args.seedVersion !== undefined
      ? { seedVersion: args.seedVersion }
      : {}),
  });
  const key = cacheKey(args.cacheDir, seedFileName, fingerprint);

  const existing = processCaches.get(key);
  if (existing !== undefined) {
    restoreProcessCacheFromSeed(key);
    const cache = processCaches.get(key);
    if (cache === undefined) {
      throw new Error('sim sqlite process cache missing after restore');
    }
    return {
      handle: {
        get sqlClient() {
          return cache.refs.sqlClient;
        },
        get sqlite() {
          return cache.refs.sqlite;
        },
        stop: async () => {
          restoreProcessCacheFromSeed(key);
        },
      },
      didMigrate: false,
    };
  }

  const { seedBuffer, didMigrate } = await ensureSimSqliteSeedBuffer(args);
  const cache = installProcessCache(key, seedBuffer, fingerprint);

  return {
    handle: {
      get sqlClient() {
        return cache.refs.sqlClient;
      },
      get sqlite() {
        return cache.refs.sqlite;
      },
      stop: async () => {
        restoreProcessCacheFromSeed(key);
      },
    },
    didMigrate,
  };
}
