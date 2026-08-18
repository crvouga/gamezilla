/**
 * Product UI-sim SQLite boot: wraps `@pkgs/sql-client` seeded SQLite with the
 * API `OpenRequestDb` façade and this package's cache/fingerprint paths.
 */

import { join } from 'node:path';
import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  type SimSqliteHandle as AgnosticSimSqliteHandle,
  bootMigratedSimSqlite as bootAgnostic,
  computeSimSqliteSeedFingerprint,
  ensureSimSqliteSeedBuffer as ensureAgnostic,
  type SimSqliteMigrateHandle,
} from '@pkgs/sql-client/sqlite/boot-sim-sqlite';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

/** Placeholder URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

const CACHE_DIR = join(__dirname, '../../.cache');
const SEED_KEY = 'sim-backend-seed.sqlite';
export const SIM_SEED_SQLITE_PATH = join(CACHE_DIR, SEED_KEY);

const MIGRATE_SOURCE_KEY = 'migrate-sim-sqlite.ts';

function createSimSqliteCacheStore(): ObjectStore {
  return createNodeFsObjectStore({
    rootDir: CACHE_DIR,
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

function createMigrateSourceStore(): ObjectStore {
  return createNodeFsObjectStore({
    rootDir: __dirname,
    fs: wallNodeFs(),
    layout: 'tree',
  });
}

export type SimSqliteHandle = AgnosticSimSqliteHandle & {
  readonly openRequestDb: OpenRequestDb;
};

async function fingerprintSource(): Promise<Buffer> {
  const text = await readUtf8(createMigrateSourceStore(), MIGRATE_SOURCE_KEY);
  if (text === null) {
    throw new Error(`missing migrate source: ${MIGRATE_SOURCE_KEY}`);
  }
  return Buffer.from(text);
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
export async function computeSimSeedFingerprint(): Promise<string> {
  return computeSimSqliteSeedFingerprint({
    fingerprintSource: await fingerprintSource(),
  });
}

/**
 * Ensure stored seed matches fingerprint. Rebuilds via `migrate` when missing
 * or stale. Returns the seed bytes and whether migrate ran.
 */
export async function ensureSimSeedBuffer(args: {
  readonly migrate: (handle: SimSqliteMigrateHandle) => Promise<void>;
}): Promise<{ readonly seedBuffer: Buffer; readonly didMigrate: boolean }> {
  return ensureAgnostic({
    store: createSimSqliteCacheStore(),
    seedKey: SEED_KEY,
    fingerprintSource: await fingerprintSource(),
    migrate: args.migrate,
  });
}

/**
 * Boots shared in-memory SQLite from the seed object (rebuilds seed when stale).
 * `stop()` restores the post-migrate snapshot for the next openSim.
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
    store: createSimSqliteCacheStore(),
    seedKey: SEED_KEY,
    fingerprintSource: await fingerprintSource(),
    migrate: args.migrate,
  });
  return { handle: withOpenRequestDb(handle), didMigrate };
}
