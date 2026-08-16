/**
 * Isomorphic Postgres schema ensure — safe for Expo web / pg-mem migrate.
 *
 * Lives outside {@link ./connect} so Metro never loads wall `pg` via
 * `EnsurePostgresSchemaMigration` → `ensurePostgresSchema`.
 */

import { raw } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import { type PostgresDbScope, quotePgIdent } from './schema';
import { assertPgSessionSchema } from './session-schema';

/**
 * Creates the application schema if it does not exist, then verifies the live
 * session resolves to it. Idempotent; call once at the start of every
 * migration entry point before any DDL runs.
 */
export async function ensurePostgresSchema(
  sqlClient: SqlClient,
  dbScope: PostgresDbScope
): Promise<void> {
  if (dbScope.schema === 'public') {
    await sqlClient.run(raw('CREATE SCHEMA IF NOT EXISTS public'));
    return;
  }
  await sqlClient.run(
    raw(`CREATE SCHEMA IF NOT EXISTS ${quotePgIdent(dbScope.schema)}`)
  );
  await assertPgSessionSchema(toPgQueryable(sqlClient), dbScope);
}

/** Adapts a {@link SqlClient} to the {@link assertPgSessionSchema} row shape. */
function toPgQueryable(sqlClient: SqlClient): {
  query<R extends Record<string, unknown>>(
    queryText: string
  ): Promise<{ rows: R[] }>;
} {
  return {
    query: async <R extends Record<string, unknown>>(queryText: string) => ({
      rows: await sqlClient.query(raw<R>(queryText)),
    }),
  };
}
