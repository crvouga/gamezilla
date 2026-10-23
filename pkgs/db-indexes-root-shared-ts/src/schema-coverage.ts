import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { AccessPath } from './types';

const PK_COL = 'id';
const SNAKE = /^[a-z][a-z0-9_]*$/;

/** Schema / PK index as plain column tuples (db-indexes stays free of db-schema). */
export type SchemaIndex = {
  readonly table: string;
  readonly columns: readonly string[];
};

/**
 * Key columns for an access path: equality, then range, then orderBy
 * (deduped, same order as candidate generation).
 */
export function pathKeyColumns(path: AccessPath): readonly string[] {
  assert.ok(path !== undefined, 'path required');
  const cols: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < path.equality.length; i++) {
    const c = path.equality[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(c);
  }
  for (let i = 0; i < path.range.length; i++) {
    const c = path.range[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(c);
  }
  for (let i = 0; i < path.orderBy.length; i++) {
    const c = path.orderBy[i]!;
    if (seen.has(c)) continue;
    seen.add(c);
    cols.push(c);
  }
  return cols;
}

/** True when the path is PK equality / IN on id (ORDER BY id alone is not scoped). */
export function isPkOnlyPath(path: AccessPath): boolean {
  if (path.equality.length === 0) return false;
  const eqs = [...new Set(path.equality)];
  if (eqs.length !== 1 || eqs[0] !== PK_COL) return false;
  for (let i = 0; i < path.range.length; i++) {
    if (path.range[i] !== PK_COL) return false;
  }
  for (let i = 0; i < path.orderBy.length; i++) {
    if (path.orderBy[i] !== PK_COL) return false;
  }
  return true;
}

/**
 * Leftmost-prefix coverage: schema index covers path iff same table and
 * path key columns are a prefix of the index columns (or equal).
 */
export function schemaCoversPath(
  index: SchemaIndex,
  path: AccessPath
): boolean {
  assert.ok(index !== undefined, 'index required');
  assert.ok(path !== undefined, 'path required');
  if (index.table !== path.table) return false;
  const key = pathKeyColumns(path);
  if (key.length === 0) return false;
  if (index.columns.length < key.length) return false;
  for (let i = 0; i < key.length; i++) {
    if (index.columns[i] !== key[i]) return false;
  }
  return true;
}

/** True if any schema index (including PK) covers the path leftmost prefix. */
export function anySchemaCoversPath(
  indexes: readonly SchemaIndex[],
  path: AccessPath
): boolean {
  assert.ok(Array.isArray(indexes), 'indexes array');
  for (let i = 0; i < indexes.length; i++) {
    if (schemaCoversPath(indexes[i]!, path)) return true;
  }
  return false;
}

export function assertSnakeCaseTable(name: string, label: string): void {
  assert.ok(typeof name === 'string', `${label}: must be string`);
  assert.ok(name.length > 0, `${label}: non-empty`);
  assert.ok(SNAKE.test(name), `${label}: must be snake_case`, { name });
}

/**
 * Build PK schema indexes for every named table: `[table, 'id']`.
 */
export function pkSchemaIndexes(
  tables: readonly string[]
): readonly SchemaIndex[] {
  assert.ok(Array.isArray(tables), 'tables array');
  const out: SchemaIndex[] = [];
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!;
    assertSnakeCaseTable(table, 'pkSchemaIndexes table');
    out.push({ table, columns: [PK_COL] });
  }
  return out;
}
