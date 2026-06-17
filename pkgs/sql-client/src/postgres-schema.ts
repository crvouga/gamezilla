/**
 * Nominal handle for an application's Postgres schema. Consumers receive an
 * injected {@link PostgresDbScope} instead of hardcoding schema names — the
 * product-specific schema string is configured once at the composition root.
 *
 * Every Postgres connection pins `search_path` to {@link PostgresDbScope.schema}
 * (see `./postgres-connect`), so all unqualified DDL/DML resolves there.
 */

export class PostgresDbScope {
  readonly schema: string;

  constructor(schema: string) {
    const trimmed = schema.trim();
    if (trimmed.length === 0) {
      throw new Error('PostgresDbScope schema must be non-empty');
    }
    this.schema = trimmed;
  }
}

/** Mints a {@link PostgresDbScope} for the given schema name. */
export function createPostgresDbScope(schema: string): PostgresDbScope {
  return new PostgresDbScope(schema);
}

/**
 * Quotes a Postgres identifier for safe interpolation into DDL / catalog SQL
 * (schema names cannot be passed as bind parameters). Embedded double quotes
 * are doubled per the SQL standard.
 */
export function quotePgIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
