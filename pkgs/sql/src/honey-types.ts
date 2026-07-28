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
 *   `orderBy` / `limit` / `offset` / `distinct` / `with` / `forUpdate`
 * - **INSERT** — `insertInto` + `values` **or** `columns`+`select` (+ optional
 *   `returning` / `onConflict`)
 * - **UPDATE** — `update` + `set` (+ optional `where` / `returning`)
 * - **DELETE** — `deleteFrom` (+ optional `where` / `returning`)
 * - **UNION** — `union` / `unionAll` (+ optional `limit`)
 *
 * ## Extensibility
 *
 * Register custom ops/fns/casts via {@link registerHoneyOp},
 * {@link registerHoneyFn}, {@link registerHoneyCast},
 * {@link registerHoneyCollation}.
 *
 * ## Expression grammar
 *
 * An {@link Expr} is one of:
 * - **Scalar** — bound parameter (`string` | `number` | `boolean` | `null` | `Date`)
 * - **Column ref** — `{ col: "u.id" }` or {@link col}
 * - **Nested query** — a {@link Query} map (compiled as a parenthesized subquery)
 * - **Op / fn call** — `[op, ...args]` ({@link OpCall})
 *
 * Built-in operators include comparisons, `and`/`or`/`not`, `in`/`not-in`,
 * `between`, `is-null`/`is-not-null`, `exists`, `cast`, `case`, `param`,
 * `||`, `->`/`->>`, `tuple`, `interval`, `like`/`not-like` (+ optional escape).
 *
 * Use `['param', scalar]` to bind a string inside function args that otherwise
 * treat bare strings as column identifiers.
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
 * - `[['fn', arg1], 't']` — set-returning / TVF call with alias
 * - `[['fn', arg], 't', [['id', 'text'], ...]]` — TVF + record column defs
 *   (`AS t (id text, …)` for `jsonb_to_recordset`)
 */
export type TableColDef = readonly [string, string];

export type TableRef =
  | string
  | readonly [string | Query | OpCall, string]
  | readonly [string | Query | OpCall, string, readonly TableColDef[]];

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

/** Optional ORDER BY modifiers. */
export type OrderOpts = {
  readonly nulls?: 'first' | 'last';
  readonly collate?: string;
};

/**
 * ORDER BY item:
 * - `'col'`
 * - `[expr, 'asc'|'desc']`
 * - `[expr, 'asc'|'desc', { nulls?, collate? }]`
 *
 * `expr` may be a column string, {@link OpCall}, or {@link ColRef}.
 */
export type OrderItem =
  | string
  | readonly [string | OpCall | ColRef, 'asc' | 'desc']
  | readonly [string | OpCall | ColRef, 'asc' | 'desc', OrderOpts];

/** Value allowed in INSERT row maps. */
export type InsertValue = Scalar | ColRef | OpCall;

/** CTE: `[alias, subquery]`. */
export type WithItem = readonly [string, Query];

/**
 * INSERT `ON CONFLICT` clause.
 */
export type OnConflict = {
  readonly target: readonly string[];
  readonly doNothing?: true;
  readonly set?: Readonly<Record<string, Expr>>;
};

/**
 * Honey query map. See module docs for which fields apply per statement kind.
 */
export interface Query {
  readonly with?: readonly WithItem[];

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
  readonly forUpdate?: boolean;
  readonly skipLocked?: boolean;

  readonly insertInto?: string;
  /** Explicit column list for INSERT…SELECT (optional when using `values`). */
  readonly columns?: readonly string[];
  /** Row(s) to insert: object or array of objects with identical keys. */
  readonly values?:
    | Readonly<Record<string, InsertValue>>
    | readonly Readonly<Record<string, InsertValue>>[];
  readonly returning?: readonly string[];
  readonly onConflict?: OnConflict;

  readonly update?: string;
  readonly set?: Readonly<Record<string, Scalar | ColRef | OpCall>>;

  /** Table name, or `[table, alias]` for aliased DELETE. */
  readonly deleteFrom?: string | readonly [string, string];

  readonly union?: readonly Query[];
  readonly unionAll?: readonly Query[];
}

/**
 * JOIN spec: `[table, onExpr]`.
 */
export type JoinSpec = readonly [TableRef, Expr];
