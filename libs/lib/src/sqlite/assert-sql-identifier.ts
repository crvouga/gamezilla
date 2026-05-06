import { assert } from '../assert';

const SQL_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SQL_PREFIX_REGEX = /^([A-Za-z_][A-Za-z0-9_]*\.)?$/;

/**
 * Asserts that `value` is a safe, simple SQL identifier (letter/underscore
 * followed by letters/digits/underscores).  Use for any string interpolated
 * directly into SQL as an identifier (table, column, alias).
 *
 * Reserved words are *not* checked — that is the SQL engine's job — but
 * everything we interpolate today is a hardcoded literal anyway, so the
 * assertion's value is in catching future code that accidentally lets user
 * input flow into an identifier slot.
 */
export function assertSqlIdentifier(
  value: unknown,
  message = 'Invalid SQL identifier',
  context?: Record<string, unknown>
): asserts value is string {
  assert.string(value, message, context);
  assert.ok(value.length > 0, message, { ...context, value });
  assert.ok(value.length <= 64, message, { ...context, value });
  assert.ok(SQL_IDENTIFIER_REGEX.test(value), message, { ...context, value });
}

/**
 * Asserts that `value` is either an empty string or `<identifier>.` — the
 * shape used by patch-db's `tableAlias` / `columnPrefix` / `attributePrefix`
 * arguments, which are concatenated directly in front of column references
 * (e.g. `p.attributes`, `attributes`).
 */
export function assertSqlPrefix(
  value: unknown,
  message = 'Invalid SQL identifier prefix (must be empty or "<identifier>.")',
  context?: Record<string, unknown>
): asserts value is string {
  assert.string(value, message, context);
  assert.ok(value.length <= 65, message, { ...context, value });
  assert.ok(SQL_PREFIX_REGEX.test(value), message, { ...context, value });
}
