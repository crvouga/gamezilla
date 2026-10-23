/**
 * Seeded `@crvouga/mockingbird-service-postgres` boot for in-process simulations.
 *
 * Migrated schema is cached via an injected {@link ObjectStore}. Each open
 * clones that seed (import PGMM envelope) instead of re-running migrations.
 * Product code injects `migrate` + fingerprint inputs — this module stays
 * app-agnostic.
 */

import { createHash } from 'node:crypto';
import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres-shared-ts/pg-types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

/** Bump when seed format / restore semantics change outside migrate source. */
export const HARNESS_MOCKINGBIRD_POSTGRES_SEED_VERSION = 3;

export type HarnessMockingbirdPostgresMigrateHandle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
};

export type EnsureHarnessMockingbirdPostgresSeedArgs = {
  /** Object store for seed + fingerprint keys. */
  readonly store: ObjectStore;
  /** Seed object key (default `harness-backend-seed.pgmm.json`). */
  readonly seedKey?: string;
  /** Extra fingerprint bytes (e.g. migrate composer source). */
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
  readonly migrate: (
    handle: HarnessMockingbirdPostgresMigrateHandle
  ) => Promise<void>;
  /** Clock for migrate logging / DB `now`. */
  readonly now?: () => number;
  /**
   * Cross-process single flight for a rebuild. The fast path (a seed already
   * in memory or on disk) does not call it. Inside it, the disk is read again
   * so a waiter reuses the winner's dump.
   */
  readonly exclusive?: <T>(fn: () => Promise<T>) => Promise<T>;
};

type ProcessSeedCache = {
  readonly seedBytes: Uint8Array;
  readonly fingerprint: string;
};

const processCaches = new Map<string, ProcessSeedCache>();

function fingerprintKeyFor(seedKey: string): string {
  return `${seedKey}.fingerprint`;
}

function cacheKey(seedKey: string, fingerprint: string): string {
  return `${seedKey}\0${fingerprint}`;
}

/** Fingerprint of migrate inputs — rebuild seed when this changes. */
export function computeHarnessMockingbirdPostgresSeedFingerprint(args: {
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
}): string {
  const version = args.seedVersion ?? HARNESS_MOCKINGBIRD_POSTGRES_SEED_VERSION;
  const source =
    typeof args.fingerprintSource === 'string'
      ? Buffer.from(args.fingerprintSource)
      : args.fingerprintSource;
  return createHash('sha256')
    .update(`v${String(version)}\n`)
    .update(source)
    .digest('hex');
}

/**
 * Ensure stored seed matches fingerprint. Rebuilds via `migrate` when missing
 * or stale. Returns the seed bytes and whether migrate ran.
 */
async function readMatchingSeed(
  args: EnsureHarnessMockingbirdPostgresSeedArgs,
  seedKey: string,
  fingerprint: string
): Promise<Uint8Array | null> {
  const cached =
    (await readUtf8(args.store, fingerprintKeyFor(seedKey)))?.trim() ?? null;
  if (cached !== fingerprint) return null;
  const bytes = await readObjectBytes(args.store, seedKey);
  return bytes === null ? null : new Uint8Array(bytes);
}

function rememberSeed(
  seedKey: string,
  fingerprint: string,
  seedBytes: Uint8Array
): { readonly seedBytes: Uint8Array; readonly didMigrate: boolean } {
  processCaches.set(cacheKey(seedKey, fingerprint), { seedBytes, fingerprint });
  return { seedBytes, didMigrate: false };
}

async function migrateSeed(
  args: EnsureHarnessMockingbirdPostgresSeedArgs,
  seedKey: string,
  fingerprint: string
): Promise<{ readonly seedBytes: Uint8Array; readonly didMigrate: boolean }> {
  const nowMs = args.now ?? (() => 0);
  const client = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(nowMs()),
    dbScope: createPostgresDbScope('public'),
  });
  await client.connect();
  const pool = adaptMockingbirdPostgresAsPool(() => client.rawDb);
  try {
    await args.migrate({ sqlClient: client, pool });
    const seedBytes = client.exportDatabaseBytes();
    await args.store.put(seedKey, seedBytes, 'application/json');
    await writeUtf8(args.store, fingerprintKeyFor(seedKey), `${fingerprint}\n`);
    processCaches.set(cacheKey(seedKey, fingerprint), {
      seedBytes,
      fingerprint,
    });
    return { seedBytes, didMigrate: true };
  } finally {
    await client.disconnect();
  }
}

export async function ensureHarnessMockingbirdPostgresSeedBuffer(
  args: EnsureHarnessMockingbirdPostgresSeedArgs
): Promise<{ readonly seedBytes: Uint8Array; readonly didMigrate: boolean }> {
  const seedKey = args.seedKey ?? 'harness-backend-seed.pgmm.json';
  const fingerprint = computeHarnessMockingbirdPostgresSeedFingerprint({
    fingerprintSource: args.fingerprintSource,
    ...(args.seedVersion !== undefined
      ? { seedVersion: args.seedVersion }
      : {}),
  });
  const inProcess = processCaches.get(cacheKey(seedKey, fingerprint));
  if (inProcess !== undefined) {
    return { seedBytes: inProcess.seedBytes, didMigrate: false };
  }
  const ready = await readMatchingSeed(args, seedKey, fingerprint);
  if (ready !== null) return rememberSeed(seedKey, fingerprint, ready);
  const rebuild = () => migrateSeed(args, seedKey, fingerprint);
  const exclusive = args.exclusive;
  if (exclusive === undefined) return rebuild();
  return exclusive(async () => {
    const again = await readMatchingSeed(args, seedKey, fingerprint);
    if (again !== null) return rememberSeed(seedKey, fingerprint, again);
    return rebuild();
  });
}

/** Clear process seed cache (tests). */
export function clearHarnessMockingbirdPostgresSeedProcessCache(): void {
  processCaches.clear();
}
