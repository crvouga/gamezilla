/**
 * Product UI-sim SQLite boot: wraps `@pkgs/simulation` seeded SQLite with the
 * API `OpenRequestDb` façade and this package's cache/fingerprint paths.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import {
  type SimSqliteHandle as AgnosticSimSqliteHandle,
  bootMigratedSimSqlite as bootAgnostic,
  computeSimSqliteSeedFingerprint,
  ensureSimSqliteSeedBuffer as ensureAgnostic,
  type SimSqliteMigrateHandle,
} from '@pkgs/simulation';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

/** Placeholder URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

const CACHE_DIR = join(__dirname, '../../.cache');
export const SIM_SEED_SQLITE_PATH = join(CACHE_DIR, 'sim-backend-seed.sqlite');

const MIGRATE_SOURCE_PATH = join(__dirname, 'migrate-sim-sqlite.ts');

export type SimSqliteHandle = AgnosticSimSqliteHandle & {
  readonly openRequestDb: OpenRequestDb;
};

function fingerprintSource(): Buffer {
  return readFileSync(MIGRATE_SOURCE_PATH);
}

function sharedRequestSqlClient(
  getHandle: () => AgnosticSimSqliteHandle
): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: (query) => getHandle().sqlClient.query(query),
    run: (query) => getHandle().sqlClient.run(query),
    prepare: (query) => getHandle().sqlClient.prepare(query),
    transaction: <T>(fn: (tx: SqlClient) => Promise<T>) =>
      getHandle().sqlClient.transaction(fn),
  };
}

function withOpenRequestDb(handle: AgnosticSimSqliteHandle): SimSqliteHandle {
  const getLive = (): AgnosticSimSqliteHandle => handle;
  const openRequestDb: OpenRequestDb = async () => {
    const live = getLive();
    return {
      kind: 'sqlite',
      sqlClient: sharedRequestSqlClient(getLive),
      sqlite: live.sqlite,
    };
  };
  return {
    get sqlClient() {
      return handle.sqlClient;
    },
    get sqlite() {
      return handle.sqlite;
    },
    openRequestDb,
    stop: () => handle.stop(),
  };
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export function computeSimSeedFingerprint(): string {
  return computeSimSqliteSeedFingerprint({
    fingerprintSource: fingerprintSource(),
  });
}

/**
 * Ensure on-disk seed matches fingerprint. Rebuilds via `migrate` when missing
 * or stale. Returns the seed bytes and whether migrate ran.
 */
export async function ensureSimSeedBuffer(args: {
  readonly migrate: (handle: SimSqliteMigrateHandle) => Promise<void>;
}): Promise<{ readonly seedBuffer: Buffer; readonly didMigrate: boolean }> {
  return ensureAgnostic({
    cacheDir: CACHE_DIR,
    fingerprintSource: fingerprintSource(),
    migrate: args.migrate,
  });
}

/**
 * Boots shared in-memory SQLite from the seed file (rebuilds seed when stale).
 * `stop()` restores the post-migrate snapshot for the next Simulation.open.
 */
export async function bootMigratedSimSqlite(args: {
  readonly migrate: (handle: {
    readonly sqlClient: SqlClient;
    readonly sqlite: BetterSqliteDatabase;
  }) => Promise<void>;
}): Promise<{
  readonly handle: SimSqliteHandle;
  readonly didMigrate: boolean;
}> {
  const { handle, didMigrate } = await bootAgnostic({
    cacheDir: CACHE_DIR,
    fingerprintSource: fingerprintSource(),
    migrate: args.migrate,
  });
  return { handle: withOpenRequestDb(handle), didMigrate };
}
