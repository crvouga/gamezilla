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
 *
 * Matchmaking does NOT run here. The `Matchmaking` class in
 * `apps/api/src/matchmaking/route.ts` self-migrates on first request
 * via a cached boot promise; the schema is declared once in that file as
 * `MATCHMAKING_SCHEMA`. Drift between migrate and runtime is impossible
 * by construction.
 */
import {
  runBetterAuthMigrations,
  type BetterAuthMigrationOptions,
} from '@libs/auth/server/better-auth-migrations';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplPostgres } from '@pkgs/patch-db/impl-postgres/impl-postgres';
import { APP_SNAPSHOT_INDEXES } from '../patch-db/snapshot-indexes';
import { dropLegacyAppSnapshotIndexes } from './drop-legacy-app-snapshot-indexes';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  databaseUrl: string;
  logger: Logger;
  betterAuthOptions: BetterAuthMigrationOptions;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, databaseUrl, logger, betterAuthOptions } = args;
  await sqlClient.transaction(async (tx) => {
    await dropLegacyAppSnapshotIndexes({ sqlClient: tx, logger });
    await PatchDbImplPostgres.migrateUp({
      sqlClient: tx,
      logger,
      options: { indexes: APP_SNAPSHOT_INDEXES },
    });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });

  await runBetterAuthMigrations({ databaseUrl, betterAuthOptions });
}
