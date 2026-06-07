/**
 * The single source of truth for the Postgres schema this application owns.
 *
 * Every Postgres connection in the codebase runs with `search_path` pinned to
 * this schema (see `./postgres-connect`), so all unqualified DDL/DML resolves
 * here and never touches `public`. The schema name string lives ONLY in this
 * module — consumers receive an injected {@link PostgresDbScope} instead of
 * re-deriving the name, which makes pointing at a different schema impossible
 * without editing this file.
 */

export const POSTGRES_SCHEMA = 'gamezilla';

export type PostgresSchemaName = typeof POSTGRES_SCHEMA;
export function assertPostgresSchema(
  schema: string
): asserts schema is PostgresSchemaName {
  if (schema !== POSTGRES_SCHEMA) {
    throw new Error(`Expected schema ${POSTGRES_SCHEMA}, got ${schema}`);
  }
}

/**
 * Nominal handle for "the application's Postgres schema". Constructed only via
 * {@link postgresDbScope} — the private constructor makes it
 * impossible to forge a scope that points anywhere else.
 */
export class PostgresDbScope {
  readonly schema: PostgresSchemaName = POSTGRES_SCHEMA;

  private constructor() {
    // Use postgresDbScope(); construction is intentionally closed.
  }

  /** @internal Only `postgresDbScope` may mint a scope. */
  static __create(): PostgresDbScope {
    return new PostgresDbScope();
  }
}

/** The one and only valid {@link PostgresDbScope}. */
export function postgresDbScope(): PostgresDbScope {
  return PostgresDbScope.__create();
}

/**
 * Quotes a Postgres identifier for safe interpolation into DDL / catalog SQL
 * (schema names cannot be passed as bind parameters). Embedded double quotes
 * are doubled per the SQL standard.
 */
export function quotePgIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
