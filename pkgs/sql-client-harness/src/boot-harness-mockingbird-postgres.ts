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
} from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres-shared/pg-types';

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
export async function ensureHarnessMockingbirdPostgresSeedBuffer(
  args: EnsureHarnessMockingbirdPostgresSeedArgs
): Promise<{ readonly seedBytes: Uint8Array; readonly didMigrate: boolean }> {
  const seedKey = args.seedKey ?? 'harness-backend-seed.pgmm.json';
  const fingerprintKey = fingerprintKeyFor(seedKey);
  const fingerprint = computeHarnessMockingbirdPostgresSeedFingerprint({
    fingerprintSource: args.fingerprintSource,
    ...(args.seedVersion !== undefined
      ? { seedVersion: args.seedVersion }
      : {}),
  });

  const processKey = cacheKey(seedKey, fingerprint);
  const inProcess = processCaches.get(processKey);
  if (inProcess !== undefined) {
    return { seedBytes: inProcess.seedBytes, didMigrate: false };
  }

  const cached = (await readUtf8(args.store, fingerprintKey))?.trim() ?? null;
  if (cached === fingerprint) {
    const bytes = await readObjectBytes(args.store, seedKey);
    if (bytes !== null) {
      const seedBytes = new Uint8Array(bytes);
      processCaches.set(processKey, { seedBytes, fingerprint });
      return { seedBytes, didMigrate: false };
    }
  }

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
    await writeUtf8(args.store, fingerprintKey, `${fingerprint}\n`);
    processCaches.set(processKey, { seedBytes, fingerprint });
    return { seedBytes, didMigrate: true };
  } finally {
    await client.disconnect();
  }
}

/** Clear process seed cache (tests). */
export function clearHarnessMockingbirdPostgresSeedProcessCache(): void {
  processCaches.clear();
}
