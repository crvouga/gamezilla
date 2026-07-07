/**
 * Canonical Postgres migration order: ensure the application schema exists →
 * drop legacy auth tables → patch-db (base DDL + declarative app
 * snapshot indexes) → kv (single caller-owned pool, `max: 1`).
 *
 * {@link ensurePostgresSchema} runs first because every connection is pinned to
 * the `gamezilla` schema via `search_path`; the schema must exist before the
 * first `CREATE TABLE` resolves there.
 *
 * App-specific snapshot indexes are derived from the frozen
 * {@link FrozenEntitySchemaRegistry} built in
 * `apps/api/src/patch-db/schema-registry.ts`; patch-db itself remains
 * application-agnostic and only consumes the injected registry.
 *
 * Matchmaking does NOT run here. The `Matchmaking` class in
 * `apps/api/src/matchmaking/route.ts` self-migrates on first request
 * via a cached boot promise; the schema is declared once in that file as
 * `MATCHMAKING_SCHEMA`. Drift between migrate and runtime is impossible
 * by construction.
 */
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { Logger } from '@pkgs/logger';
import { ensurePostgresSchema } from '@pkgs/sql-client/postgres-connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplPostgres } from '@pkgs/patch-db/impl-postgres/impl-postgres';
import { buildAppPatchDbSchemaRegistry } from '../patch-db/schema-registry';
import { dropLegacyAuthTables } from './drop-legacy-auth-tables';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  logger: Logger;
  dbScope: PostgresDbScope;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, logger, dbScope } = args;
  await ensurePostgresSchema(sqlClient, dbScope);
  await dropLegacyAuthTables(sqlClient, logger);

  const schemaRegistry = buildAppPatchDbSchemaRegistry();
  await sqlClient.transaction(async (tx) => {
    await PatchDbImplPostgres.migrateUp({
      sqlClient: tx,
      logger,
      options: { schemaRegistry },
    });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
  });
}
