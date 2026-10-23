/**
 * Low-level helpers that pin a Postgres session's `search_path` to a
 * {@link PostgresDbScope}. Two complementary mechanisms are used so the schema
 * is enforced regardless of how the connection was opened:
 *
 *   1. {@link setPgSessionSchema} runs `SET search_path` on a connection. For
 *      `node-postgres` pools this is wired through the awaited `onConnect`
 *      hook, so every pooled connection is configured before it is handed out
 *      (race-free before the connection is handed out).
 *   2. {@link withPostgresSearchPathOption} bakes `options=-c search_path=...`
 *      into the connection string. PostgreSQL applies it per physical
 *      connection at startup — used for Bun's `SQL` driver, which has no
 *      awaited per-connection hook.
 *
 * {@link assertPgSessionSchema} verifies the live session actually resolves to
 * the expected schema.
 */
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { quotePgIdent } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

/** Anything that can run a text query and hand back rows (pg `Client` / `Pool` / `PoolClient`). */
export interface PgQueryable {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    queryText: string
  ): Promise<{ rows: R[] }>;
}

/**
 * PgBouncer / Neon pooler endpoints reject libpq startup `options` (including
 * `-c search_path=…`). Callers must pin the schema with
 * {@link setPgSessionSchema} after the session is established.
 */
export function postgresRejectsStartupSearchPathOption(
  connectionString: string
): boolean {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return host.includes('-pooler') || host.includes('.pooler.');
  } catch {
    return false;
  }
}

/**
 * Adds the startup `options=-c search_path=<schema>` parameter to a Postgres
 * connection string. PostgreSQL applies it per physical connection, so every
 * connection in a pool resolves unqualified names to the scope's schema with
 * no setup race. TLS sanitizing is left to the caller (drivers differ).
 *
 * When {@link postgresRejectsStartupSearchPathOption} is true the URL is
 * returned unchanged — the caller must run {@link setPgSessionSchema} after
 * connect (see {@link SqlClientImplBunPostgres}).
 */
export function withPostgresSearchPathOption(
  connectionString: string,
  dbScope: PostgresDbScope
): string {
  if (postgresRejectsStartupSearchPathOption(connectionString)) {
    return connectionString;
  }
  try {
    const url = new URL(connectionString);
    url.searchParams.set('options', `-c search_path=${dbScope.schema}`);
    return url.toString();
  } catch {
    return connectionString;
  }
}

/** Pins a connection's `search_path` to the scope's schema. */
export async function setPgSessionSchema(
  queryable: PgQueryable,
  dbScope: PostgresDbScope
): Promise<void> {
  await queryable.query(`SET search_path TO ${quotePgIdent(dbScope.schema)}`);
}

/**
 * Prefixes SQL with `SET search_path` so Neon/PgBouncer transaction pooling
 * gets one round trip instead of a separate pin query before every statement.
 */
export function sqlBundledWithSearchPath(
  dbScope: PostgresDbScope,
  sql: string
): string {
  return `SET search_path TO ${quotePgIdent(dbScope.schema)}; ${sql}`;
}

/** Asserts the live session resolves unqualified names to the scope's schema. */
export async function assertPgSessionSchema(
  queryable: PgQueryable,
  dbScope: PostgresDbScope
): Promise<void> {
  const result = await queryable.query<{ current_schema: string | null }>(
    'SELECT current_schema() AS current_schema'
  );
  const current = result.rows[0]?.current_schema ?? null;
  if (current === dbScope.schema) {
    return;
  }
  if (dbScope.schema === 'public') {
    const paths = await queryable.query<{ includes_public: boolean }>(
      `SELECT 'public' = ANY (current_schemas(true)) AS includes_public`
    );
    assert.ok(
      paths.rows[0]?.includes_public === true,
      'Postgres session search_path must include public',
      { expected: dbScope.schema, current }
    );
    return;
  }
  assert.equals(
    current,
    dbScope.schema,
    'Postgres session search_path must resolve to the application schema',
    { expected: dbScope.schema, current }
  );
}

/**
 * On Neon/PgBouncer transaction poolers, session `SET` does not survive the
 * next round trip — pin + verify must share one backend transaction (same
 * pattern as {@link pgQueryOnPinnedSession}).
 */
async function pinAndVerifyOnPooler(
  queryable: PgQueryable,
  dbScope: PostgresDbScope
): Promise<void> {
  await queryable.query('BEGIN');
  try {
    await queryable.query(
      `SET LOCAL search_path TO ${quotePgIdent(dbScope.schema)}`
    );
    await assertPgSessionSchema(queryable, dbScope);
    await queryable.query('COMMIT');
  } catch (error: unknown) {
    try {
      await queryable.query('ROLLBACK');
    } catch (rollbackError: unknown) {
      throw new AggregateError(
        [error, rollbackError],
        'Postgres search_path pin failed and transaction rollback also failed'
      );
    }
    throw error;
  }
}

/**
 * Pins and verifies `search_path` on a new session. Direct Postgres keeps a
 * session GUC; pooler URLs verify inside one BEGIN/SET LOCAL/COMMIT so the
 * check is not split across backends.
 */
export async function pinAndVerifyPgSessionSchema(
  queryable: PgQueryable,
  dbScope: PostgresDbScope,
  connectionString: string
): Promise<void> {
  if (postgresRejectsStartupSearchPathOption(connectionString)) {
    await pinAndVerifyOnPooler(queryable, dbScope);
    return;
  }
  await setPgSessionSchema(queryable, dbScope);
  await assertPgSessionSchema(queryable, dbScope);
}
