/**
 * Honey — a HoneySQL-inspired, data-driven SQL compiler for `@pkgs/sql`.
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
 * - There is deliberately **no raw-string escape hatch** in honey. Compose with
 *   `sql` / `raw` / `unsafe` from `@pkgs/sql` only when you intentionally leave
 *   the honey map DSL.
 *
 * ## Output
 *
 * {@link sqlMap} returns a {@link Sql} instance — nestable in `sql\`...\`` and
 * readable via `.sql` (`?`), `.text` (`$n`), `.statement` (`:n`), and `.values`.
 *
 * @example
 * ```ts
 * import { honey, col, sql } from '@pkgs/sql';
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
 *     set: { value: col('excluded.value'), updated_at: ['now'] },
 *   },
 * });
 *
 * q.text    // SELECT id, name, COUNT(*) AS n FROM users AS u ...
 * q.values  // [true, 'admin', 'staff', 10]
 *
 * // Nest inside a template fragment:
 * const wrapped = sql`EXPLAIN ${q}`;
 * ```
 *
 * @module
 */

import { assert } from '@pkgs/assert';

import { compileQuery } from './honey-statements';
import type { ColRef, Query } from './honey-types';
import type { Sql } from './sql';

export type {
  ColRef,
  Expr,
  InsertValue,
  JoinSpec,
  OpCall,
  OrderItem,
  OrderOpts,
  Query,
  Scalar,
  SelectItem,
  TableRef,
} from './honey-types';

/**
 * Regression guard: honey `values` is insert row map(s), not {@link Sql.values}
 * (`readonly Value[]`). A bad unify surfaces as TS2561 on `{ key: ... }` inserts.
 */
type _HoneyValuesNotSqlValues = [NonNullable<Query['values']>] extends [
  Sql['values'],
]
  ? never
  : true;
true satisfies _HoneyValuesNotSqlValues;

export {
  registerHoneyCast,
  registerHoneyCollation,
  registerHoneyFn,
  registerHoneyOp,
  resetHoneyRegistry,
} from './honey-registry';
export type { HoneyCompileCtx, HoneyOpCompiler } from './honey-registry';

/**
 * Compile a honey query map to a nested {@link Sql} fragment.
 *
 * Pure function: no I/O, no connection. Misuse (bad identifiers, unknown ops,
 * empty insert, …) crashes via `@pkgs/assert`.
 *
 * @param query - HoneySQL-style query map (see {@link Query}).
 * @returns Nested {@link Sql} ready to execute or embed in `sql\`...\``.
 */
export function sqlMap(query: Query): Sql {
  assert.ok(
    query !== null && typeof query === 'object' && !Array.isArray(query),
    'honey: query must be an object',
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
  assert.string(name, 'honey: col() expects a string', { name });
  assert.ok(name.length > 0, 'honey: col() name must be non-empty', { name });
  return { col: name };
}
