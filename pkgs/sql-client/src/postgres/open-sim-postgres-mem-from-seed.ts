/**
 * Open a postgres-mem DB from a post-migrate PGMM seed.
 * Kept separate from {@link ./boot-sim-postgres-mem.ts} so Expo native
 * (Hermes) can restore seeds without bundling `node:crypto`.
 */

import type { Clock } from '@pkgs/clock';
import {
  adaptPostgresMemAsPool,
  SqlClientImplPostgresMem,
} from './impl-postgres-mem';
import type { Pool } from './pg-types';
import { createPostgresDbScope } from './schema';

export type OpenSimPostgresMemFromSeedArgs = {
  readonly seedBytes: Uint8Array;
  readonly clock: Clock;
  readonly logicalName?: string;
};

export type SimPostgresMemSqlBundle = {
  readonly sqlClient: SqlClientImplPostgresMem;
  readonly pool: Pool;
  disconnect(): Promise<void>;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
};

/** Open a fresh postgres-mem DB restored from a post-migrate seed envelope. */
export function openSimPostgresMemFromSeed(
  args: OpenSimPostgresMemFromSeedArgs
): SimPostgresMemSqlBundle {
  const client = SqlClientImplPostgresMem.open({
    seed: 1,
    now: () => new Date(args.clock.now()),
    dbScope: createPostgresDbScope('public'),
    // Seed already includes JSON1 shims from migrate-time open.
    installSqliteCompat: false,
  });
  client.importDatabaseBytes(args.seedBytes);
  const pool = adaptPostgresMemAsPool(() => client.rawDb);
  return {
    sqlClient: client,
    pool,
    disconnect: () => client.disconnect(),
    exportBytes: () => client.exportDatabaseBytes(),
    importBytes: (bytes) => {
      client.importDatabaseBytes(bytes);
    },
  };
}
