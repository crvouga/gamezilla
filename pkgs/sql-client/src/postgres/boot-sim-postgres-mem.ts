/**
 * Seeded `@crvouga/postgres-mem` boot for in-process simulations.
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
} from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SqlClient } from '../interface';
import {
  adaptPostgresMemAsPool,
  SqlClientImplPostgresMem,
} from './impl-postgres-mem';
import type { Pool } from './pg-types';
import { createPostgresDbScope } from './schema';

export type {
  OpenSimPostgresMemFromSeedArgs,
  SimPostgresMemSqlBundle,
} from './open-sim-postgres-mem-from-seed';
export { openSimPostgresMemFromSeed } from './open-sim-postgres-mem-from-seed';

/** Bump when seed format / restore semantics change outside migrate source. */
export const SIM_POSTGRES_MEM_SEED_VERSION = 3;

export type SimPostgresMemMigrateHandle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
};

export type EnsureSimPostgresMemSeedArgs = {
  /** Object store for seed + fingerprint keys. */
  readonly store: ObjectStore;
  /** Seed object key (default `sim-backend-seed.pgmm.json`). */
  readonly seedKey?: string;
  /** Extra fingerprint bytes (e.g. migrate composer source). */
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
  readonly migrate: (handle: SimPostgresMemMigrateHandle) => Promise<void>;
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
export function computeSimPostgresMemSeedFingerprint(args: {
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
}): string {
  const version = args.seedVersion ?? SIM_POSTGRES_MEM_SEED_VERSION;
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
export async function ensureSimPostgresMemSeedBuffer(
  args: EnsureSimPostgresMemSeedArgs
): Promise<{ readonly seedBytes: Uint8Array; readonly didMigrate: boolean }> {
  const seedKey = args.seedKey ?? 'sim-backend-seed.pgmm.json';
  const fingerprintKey = fingerprintKeyFor(seedKey);
  const fingerprint = computeSimPostgresMemSeedFingerprint({
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
  const client = SqlClientImplPostgresMem.open({
    seed: 1,
    now: () => new Date(nowMs()),
    dbScope: createPostgresDbScope('public'),
  });
  await client.connect();
  const pool = adaptPostgresMemAsPool(() => client.rawDb);
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
export function clearSimPostgresMemSeedProcessCache(): void {
  processCaches.clear();
}
