/**
 * Open a mockingbird-postgres DB from a post-migrate PGMM seed.
 * Kept separate from {@link ./boot-sim-mockingbird-postgres.ts} so the browser
 * can restore seeds without bundling `node:crypto`.
 */

import type { Clock } from '@pkgs/clock';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres/pg-types';

export type OpenSimMockingbirdPostgresFromSeedArgs = {
  readonly seedBytes: Uint8Array;
  readonly clock: Clock;
  readonly logicalName?: string;
};

export type SimMockingbirdPostgresSqlBundle = {
  readonly sqlClient: SqlClientImplMockingbirdPostgres;
  readonly pool: Pool;
  disconnect(): Promise<void>;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
};

/** Open a fresh mockingbird-postgres DB restored from a post-migrate seed envelope. */
export function openSimMockingbirdPostgresFromSeed(
  args: OpenSimMockingbirdPostgresFromSeedArgs
): SimMockingbirdPostgresSqlBundle {
  const client = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(args.clock.now()),
    dbScope: createPostgresDbScope('public'),
    // Seed already includes JSON1 shims from migrate-time open.
    installSqliteCompat: false,
  });
  client.importDatabaseBytes(args.seedBytes);
  const pool = adaptMockingbirdPostgresAsPool(() => client.rawDb);
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
