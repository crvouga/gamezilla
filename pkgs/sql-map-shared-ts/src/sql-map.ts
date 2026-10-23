/**
 * Sql map — a data-driven SQL compiler (`@pkgs/sql-map-shared-ts`) that emits `@pkgs/sql` fragments.
 *
 * SQL as plain data structures. Zero connection, no classes to instantiate.
 * Queries are JSON-serializable objects (except `Date` scalars), which makes
 * them easy to build at runtime, easy to validate, and easy for LLMs to emit
 * (pair with JSON-schema structured output for runtime generation).
 *
 * ## Safety model
 *
 * - All **values** are parameterized (bound via {@link Sql}, never concatenated).
 * - All **identifiers** (tables/columns/aliases) are validated and spliced via
 *   {@link ident} / dotted paths. Invalid names crash.
 * - There is deliberately **no raw-string escape hatch** in the sql-map DSL.
 *   Compose with `sql` / `raw` / `unsafe` from `@pkgs/sql` only when you
 *   intentionally leave the sql-map DSL.
 *
 * ## Output
 *
 * {@link sqlMap} returns a {@link Sql} instance — nestable in `sql\`...\`` and
 * readable via `.sql` (`?`), `.text` (`$n`), `.statement` (`:n`), and `.values`.
 *
 * @example
 * ```ts
 * import { sqlMap, col } from '@pkgs/sql-map-shared-ts';
 * import { sql } from '@pkgs/sql';
 *
 * const q = sqlMap({
 *   select: ['id', 'name', [['count', '*'], 'n']],
 *   from: [['users', 'u']],
 *   join: [['orders', 'o'], ['=', 'o.user_id', col('u.id')]],
 *   where: ['and', ['=', 'u.active', true], ['in', 'u.role', ['admin', 'staff']]],
 *   groupBy: ['id', 'name'],
 *   orderBy: [['n', 'desc']],
 *   limit: 10,
 * });
 *
 * // Upsert with cast + ON CONFLICT:
 * sqlMap({
 *   insertInto: 'kv',
 *   values: { key: 'k', value: ['cast', '{}', 'jsonb'] },
 *   onConflict: {
 *     target: ['key'],
 *     set: { value: col('excluded.value'), updated_at: 1 },
 *   },
 * });
 *
 * q.text    // SELECT id, name, COUNT(*) AS n FROM users AS u ...
 * q.values  // [true, 'admin', 'staff', 10]
 *
 * // Nest inside a template fragment:
 * const wrapped = sql<void>`EXPLAIN ${q}`;
 * ```
 *
 * @module
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { compileQuery } from './sql-map-statements';
import type { ColRef, Query } from './sql-map-types';

/**
 * Regression guard: sql-map `values` is insert row map(s), not {@link Sql.values}
 * (`readonly Value[]`). A bad unify surfaces as TS2561 on `{ key: ... }` inserts.
 */
type _SqlMapValuesNotSqlValues = [NonNullable<Query['values']>] extends [
  Sql['values'],
]
  ? never
  : true;
true satisfies _SqlMapValuesNotSqlValues;

/**
 * Compile a sql-map query to a nested {@link Sql} fragment.
 *
 * Pure function: no I/O, no connection. Misuse (bad identifiers, unknown ops,
 * empty insert, …) crashes via `@pkgs/assert-root-shared-ts`.
 *
 * @param query - Sql-map query object (see {@link Query}).
 * @returns Nested {@link Sql} ready to execute or embed in `sql\`...\``.
 */
export function sqlMap(query: Query): Sql {
  assert.ok(
    query !== null && typeof query === 'object' && !Array.isArray(query),
    'sqlMap: query must be an object',
    { query }
  );
  return compileQuery(query);
}

/**
 * Shorthand for a column reference in value position.
 *
 * @example
 * ```ts
 * sqlMap({
 *   update: 'users',
 *   set: { updated_at: col('created_at') },
 *   where: ['=', 'id', 1],
 * });
 * ```
 */
export function col(name: string): ColRef {
  assert.string(name, 'sqlMap: col() expects a string', { name });
  assert.ok(name.length > 0, 'sqlMap: col() name must be non-empty', { name });
  return { col: name };
}
