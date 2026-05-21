import { assert } from '@gamezilla/assert';
import { assertAttribute } from '../interface';

function buildSqliteJsonPath(key: string): string {
  assertAttribute(key);
  const needsQuote = /[./[\]]/.test(key);
  const literal = needsQuote ? `$."${key.replace(/"/g, '""')}"` : `$.${key}`;
  return literal.replace(/'/g, "''");
}

function toSqliteJsonSetValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value;
}

/**
 * Builds a `json_set(attributes, …)` expression + bind params for one patch
 * update.  Asserts that `attributes` is non-empty (an empty input would emit
 * `json_set(attributes, )`, which is invalid SQL).
 */
export function buildSqliteUpdateJsonSet(attributes: Record<string, unknown>): {
  expr: string;
  params: unknown[];
} {
  const entries = Object.entries(attributes);
  assert.ok(
    entries.length > 0,
    'buildSqliteUpdateJsonSet requires at least one attribute (empty input would produce "json_set(attributes, )")'
  );
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of entries) {
    parts.push(`'${buildSqliteJsonPath(key)}', ?`);
    params.push(toSqliteJsonSetValue(value));
  }
  return { expr: `json_set(attributes, ${parts.join(', ')})`, params };
}
