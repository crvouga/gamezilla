/**
 * Seeded PGlite boot for in-process simulations (playground + `@product/test`).
 *
 * Migrated schema is cached via an injected {@link ObjectStore}. Each open
 * clones that seed (`loadDataDir`) instead of re-running migrations.
 */

import { createHash } from 'node:crypto';
import type { Clock } from '@pkgs/clock';
import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SqlClient } from '../interface';
import { openPgliteSqlClient, type PgliteSqlBundle } from './impl-pglite';
import type { Pool } from './pg-types';

/** Bump when seed format / restore semantics change outside migrate source. */
export const SIM_PGLITE_SEED_VERSION = 1;

export type SimPgliteMigrateHandle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
};

export type EnsureSimPgliteSeedArgs = {
  readonly store: ObjectStore;
  /** Seed object key (default `sim-backend-seed.pglite.bin`). */
  readonly seedKey?: string;
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
  readonly migrate: (handle: SimPgliteMigrateHandle) => Promise<void>;
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

export function computeSimPgliteSeedFingerprint(args: {
  readonly fingerprintSource: Buffer | string;
  readonly seedVersion?: number;
}): string {
  const version = args.seedVersion ?? SIM_PGLITE_SEED_VERSION;
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
 * or stale.
 */
export async function ensureSimPgliteSeedBuffer(
  args: EnsureSimPgliteSeedArgs
): Promise<{ readonly seedBytes: Uint8Array; readonly didMigrate: boolean }> {
  const seedKey = args.seedKey ?? 'sim-backend-seed.pglite.bin';
  const fingerprintKey = fingerprintKeyFor(seedKey);
  const fingerprint = computeSimPgliteSeedFingerprint({
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

  const live = await openPgliteSqlClient();
  try {
    await args.migrate({ sqlClient: live.sqlClient, pool: live.pool });
    const seedBytes = await live.exportBytes();
    await args.store.put(seedKey, seedBytes, 'application/octet-stream');
    await writeUtf8(args.store, fingerprintKey, `${fingerprint}\n`);
    processCaches.set(processKey, { seedBytes, fingerprint });
    return { seedBytes, didMigrate: true };
  } finally {
    await live.disconnect();
  }
}

export type OpenSimPgliteFromSeedArgs = {
  readonly seedBytes: Uint8Array;
  readonly clock: Clock;
};

export type SimPgliteSqlBundle = PgliteSqlBundle;

/** Open a fresh PGlite DB restored from a post-migrate gzip dump. */
export async function openSimPgliteFromSeed(
  args: OpenSimPgliteFromSeedArgs
): Promise<SimPgliteSqlBundle> {
  void args.clock;
  return openPgliteSqlClient({ seedBytes: args.seedBytes });
}

export function clearSimPgliteSeedProcessCache(): void {
  processCaches.clear();
}
