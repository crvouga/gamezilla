import { assert } from '@pkgs/assert';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-schema';

/** Postgres schema for the dev IdP process — set via `POSTGRES_SCHEMA` in dev scripts. */
export function readDevIdpPostgresSchema(): string {
  const schema = (process.env['POSTGRES_SCHEMA'] ?? '').trim();
  if (schema.length === 0) {
    assert.fail(
      'POSTGRES_SCHEMA is required for @pkgs/dev-idp (e.g. POSTGRES_SCHEMA=gamezilla)'
    );
  }
  return schema;
}

export function devIdpPostgresDbScope() {
  return createPostgresDbScope(readDevIdpPostgresSchema());
}
