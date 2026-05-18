/**
 * Canonical Postgres migration order: legacy index cleanup → patch-db (base
 * DDL + declarative app snapshot indexes) → kv → Better Auth (Kysely).
 *
 * `dropLegacyAppSnapshotIndexes` runs **before** patch-db's `migrateUp`
 * because the new declarative reconciler only manages indexes whose names
 * start with `pdb_idx_`; the legacy hand-written `idx_snap_*` indexes must be
 * dropped explicitly. After one production deploy cycle this step can be
 * removed entirely.
 *
 * App-specific snapshot indexes are passed to `PatchDbImplPostgres.migrateUp`
 * via `options.indexes`; patch-db itself remains application-agnostic and
 * does not know about our domain entity types.
 *
 * Better Auth DDL runs after the transaction. Kysely owns its own short-lived
 * pool (created from `databaseUrl`) so `kysely.destroy()` cannot end a pool
 * the caller still owns — `pg.Pool.end()` throws on a second call.
 */
import {
  runBetterAuthMigrations,
  type BetterAuthMigrationOptions,
} from '@gamezilla/auth/server/better-auth-migrations';
import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { migrate as migrateMatchmaking } from '@gamezilla/matchmaking/migrate';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { Pool } from 'pg';
import { APP_SNAPSHOT_INDEXES } from '../patch-db/snapshot-indexes';
import { dropLegacyAppSnapshotIndexes } from './drop-legacy-app-snapshot-indexes';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  pool: Pool;
  databaseUrl: string;
  logger: Logger;
  betterAuthOptions: BetterAuthMigrationOptions;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, pool, databaseUrl, logger, betterAuthOptions } = args;
  await sqlClient.transaction(async (tx) => {
    await dropLegacyAppSnapshotIndexes({ sqlClient: tx, logger });
    await PatchDbImplPostgres.migrateUp({
      sqlClient: tx,
      logger,
      options: { indexes: APP_SNAPSHOT_INDEXES },
    });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });

  // Matchmaking owns its own `matchmaking_queue` table. Runs outside the
  // patch-db/kv transaction because the matchmaking package has its own
  // `SqlClient` shape (uses native pg `$1` params, returns `{ rows }`) and
  // accepts a `pg.Pool` directly.
  //
  // The schema block is the only knob the API has to opt domains into
  // bucketed / partitioned matching. Defaults below produce a single
  // global shard without rating bucketing — safe and slow. When a concrete
  // domain ships, declare its partition keys and rating axis here; mirror
  // the same values in `packages/api/src/matchmaking/route.ts` so the
  // Matchmaker's lazy schema-fingerprint assert agrees. For example, a
  // chess deployment would use:
  //
  //   schema: {
  //     partitionKeys: ['chess/mode', 'chess/time-control', 'chess/region'],
  //     primaryNumericKey: 'chess/rating',
  //     bucketWidth: 50,
  //   }
  //
  // Each declared partition key becomes a shard axis for the per-partition
  // throttle in `matchmaking_pass_runs`, so N partitions = N concurrent
  // matchers on one Postgres primary.
  await migrateMatchmaking({
    pool,
    schema: {
      partitionKeys: [],
      bucketWidth: 50,
    },
  });

  await runBetterAuthMigrations({ databaseUrl, betterAuthOptions });
}
