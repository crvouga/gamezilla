import { assert } from '../assert';
import { ENTITY_DB_LIMITS } from './interface';

/** Postgres-safe unquoted identifier: letter or underscore, then alphanum/underscore, length bounded. */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertSafeIdentifier(name: string, role: string): void {
  assert.nonEmptyString(name, `entity-db: ${role} must be non-empty string`, {
    role,
    name,
  });
  assert.ok(
    name.length <= ENTITY_DB_LIMITS.MAX_IDENTIFIER_LEN,
    `entity-db: ${role} exceeds max identifier length`,
    { role, name, max: ENTITY_DB_LIMITS.MAX_IDENTIFIER_LEN }
  );
  assert.ok(
    SAFE_IDENTIFIER.test(name),
    `entity-db: ${role} failed safe identifier regex`,
    { role, name }
  );
}

/** Qualified table name for SQL fragments (identifiers only — validated). */
export function qualifiedTable(tableName: string, schema?: string): string {
  assertSafeIdentifier(tableName, 'tableName');
  if (schema !== undefined && schema.length > 0) {
    assertSafeIdentifier(schema, 'schema');
    return `${schema}.${tableName}`;
  }
  return tableName;
}
