/**
 * Open a mockingbird-postgres DB from a post-migrate PGMM seed.
 * Kept separate from {@link ./boot-harness-mockingbird-postgres.ts} so the browser
 * can restore seeds without bundling `node:crypto`.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import {
  adaptMockingbirdPostgresAsPool,
  SqlClientImplMockingbirdPostgres,
} from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type { Pool } from '@pkgs/sql-client-postgres-shared/pg-types';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';

export type OpenHarnessMockingbirdPostgresFromSeedArgs = {
  readonly seedBytes: Uint8Array;
  readonly clock: Clock;
  readonly logicalName?: string;
};

export type HarnessMockingbirdPostgresSqlBundle = {
  readonly sqlClient: SqlClientImplMockingbirdPostgres;
  readonly pool: Pool;
  disconnect(): Promise<void>;
  exportBytes(): Uint8Array;
  importBytes(bytes: Uint8Array): void;
};

/** Open a fresh mockingbird-postgres DB restored from a post-migrate seed envelope. */
export function openHarnessMockingbirdPostgresFromSeed(
  args: OpenHarnessMockingbirdPostgresFromSeedArgs
): HarnessMockingbirdPostgresSqlBundle {
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
