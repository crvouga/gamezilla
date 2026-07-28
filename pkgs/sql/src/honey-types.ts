/**
 * HoneySQL-inspired query map types for {@link honey}.
 *
 * Queries are plain JSON-serializable objects (except {@link Date} scalars).
 * Suitable for runtime construction and LLM structured output.
 *
 * ## Statement kinds
 *
 * Pick one shape per query:
 * - **SELECT** — `select` / `from` / `join*` / `where` / `groupBy` / `having` /
 *   `orderBy` / `limit` / `offset` / `distinct`
 * - **INSERT** — `insertInto` + `values` (+ optional `returning`)
 * - **UPDATE** — `update` + `set` (+ optional `where` / `returning`)
 * - **DELETE** — `deleteFrom` (+ optional `where` / `returning`)
 *
 * ## Expression grammar
 *
 * An {@link Expr} is one of:
 * - **Scalar** — bound parameter (`string` | `number` | `boolean` | `null` | `Date`)
 * - **Column ref** — `{ col: "u.id" }` or {@link col}
 * - **Nested query** — a {@link Query} map (compiled as a parenthesized subquery)
 * - **Op / fn call** — `[op, ...args]` ({@link OpCall})
 *
 * Known operators: `= != <> < <= > >= like ilike + - * /`, `and` / `or` /
 * `not`, `in` / `not-in`, `between`, `is-null` / `is-not-null`, `exists`.
 *
 * Known functions: `count` `sum` `avg` `min` `max` `lower` `upper` `length`
 * `abs` `round` `coalesce` `now`.
 *
 * ## Identifiers
 *
 * Table/column/alias names must match `[A-Za-z_][A-Za-z0-9_]*` (dotted paths
 * like `u.id` and lone `*` are allowed). There is no raw-SQL escape hatch.
 */

/** A reference to a column, usable anywhere a value is expected. */
export type ColRef = { readonly col: string };

/** Scalar values that become bound parameters (never spliced into SQL text). */
export type Scalar = string | number | boolean | null | Date;

/**
 * An expression: scalar param, column ref, nested query, or op/fn call.
 *
 * @example
 * ```ts
 * ['=', 'u.active', true]
 * ['and', ['=', 'u.id', 1], ['is-not-null', 'u.email']]
 * ['count', '*']
 * ['in', 'id', [1, 2, 3]]
 * { col: 'u.id' }
 * ```
 */
export type Expr = Scalar | ColRef | Query | OpCall;

/**
 * Operator or function call as a tuple.
 *
 * @example `['=', 'a.id', 5]` · `['and', e1, e2]` · `['count', '*']`
 */
export type OpCall = readonly [string, ...unknown[]];

/**
 * Table reference.
 *
 * - `'users'` — bare table
 * - `['users', 'u']` — table with alias
 * - `[{ select: [...] }, 'sq']` — subquery with alias
 *
 * A 2-element string array always means `[table, alias]`. For a multi-table
 * FROM (cross join), alias each: `from: [['t1','t1'], ['t2','t2']]`, or use
 * explicit `join`.
 */
export type TableRef = string | readonly [string | Query, string];

/**
 * SELECT list item.
 *
 * - `'col'` — column
 * - `[expr, 'alias']` — expression with alias (e.g. `[['count', '*'], 'n']`)
 * - `OpCall` — bare expression (e.g. `['now']`)
 */
export type SelectItem =
  | string
  | readonly [string | OpCall | Query, string]
  | OpCall;

/** ORDER BY item: `'col'` or `['col', 'asc' | 'desc']`. */
export type OrderItem = string | readonly [string, 'asc' | 'desc'];

/**
 * Honey query map. See module docs for which fields apply per statement kind.
 */
export interface Query {
  readonly select?: readonly SelectItem[];
  readonly distinct?: boolean;
  readonly from?: TableRef | readonly TableRef[];
  readonly join?: JoinSpec | readonly JoinSpec[];
  readonly leftJoin?: JoinSpec | readonly JoinSpec[];
  readonly rightJoin?: JoinSpec | readonly JoinSpec[];
  readonly where?: Expr;
  readonly groupBy?: readonly string[];
  readonly having?: Expr;
  readonly orderBy?: readonly OrderItem[];
  readonly limit?: number;
  readonly offset?: number;

  readonly insertInto?: string;
  /** Row(s) to insert: object or array of objects with identical keys. */
  readonly values?:
    | Readonly<Record<string, Scalar | ColRef>>
    | readonly Readonly<Record<string, Scalar | ColRef>>[];
  readonly returning?: readonly string[];

  readonly update?: string;
  readonly set?: Readonly<Record<string, Scalar | ColRef | OpCall>>;

  readonly deleteFrom?: string;
}

/**
 * JOIN spec: `[table, onExpr]`.
 *
 * @example `[['orders', 'o'], ['=', 'o.user_id', { col: 'u.id' }]]`
 */
export type JoinSpec = readonly [TableRef, Expr];
