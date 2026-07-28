import { assert } from '@pkgs/assert';

import { columnIdent } from './honey-ident';
import { HONEY_LIST_SEP } from './honey-list-sep';
import type { ColRef, OpCall, Query, Scalar } from './honey-types';
import sql, { join, raw, type Sql } from './sql';

/** Infix comparison / arithmetic operators. */
const INFIX = new Set([
  '=',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'like',
  'ilike',
  '+',
  '-',
  '*',
  '/',
]);

const LOGIC = new Set(['and', 'or']);

const KEYWORD_OPS = new Set([
  'not',
  'in',
  'not-in',
  'between',
  'is-null',
  'is-not-null',
  'exists',
  'cast',
  'case',
  'param',
]);

const FUNCTIONS = new Set([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'lower',
  'upper',
  'length',
  'abs',
  'round',
  'coalesce',
  'now',
  'hashtext',
  'pg_advisory_xact_lock',
  'pg_try_advisory_lock',
  'pg_advisory_unlock',
  'jsonb_to_recordset',
]);

/** Allowlisted SQL cast targets (`expr::type`). */
const CAST_TYPES = new Set([
  'text',
  'jsonb',
  'int',
  'bigint',
  'uuid',
  'boolean',
  'timestamptz',
  'integer',
]);

/** True when `head` is a known operator or function name (select-item disambiguation). */
export function isOpOrFnHead(head: unknown): boolean {
  if (typeof head !== 'string') {
    return false;
  }
  const o = head.toLowerCase();
  return (
    INFIX.has(o) || LOGIC.has(o) || FUNCTIONS.has(o) || KEYWORD_OPS.has(o)
  );
}

export function isColRef(x: unknown): x is ColRef {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    'col' in x &&
    typeof (x as ColRef).col === 'string' &&
    Object.keys(x).length === 1
  );
}

const QUERY_KEYS = [
  'select',
  'from',
  'insertInto',
  'update',
  'deleteFrom',
  'union',
  'unionAll',
] as const;

export function isQuery(x: unknown): x is Query {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  if (x instanceof Date) {
    return false;
  }
  return QUERY_KEYS.some((k) => k in x);
}

function isScalar(x: unknown): x is Scalar {
  return (
    x === null ||
    typeof x === 'string' ||
    typeof x === 'number' ||
    typeof x === 'boolean' ||
    x instanceof Date
  );
}

/** Filled by {@link wireCompileQuery} to compile nested query maps. */
let compileQueryFn: ((q: Query) => Sql) | undefined;

/** Wires the statement compiler so expression subqueries can nest. */
export function wireCompileQuery(fn: (q: Query) => Sql): void {
  compileQueryFn = fn;
}

function compileSubquery(q: Query): Sql {
  assert.defined(compileQueryFn, 'honey: compileQuery not wired');
  return compileQueryFn(q);
}

/**
 * Compiles any expression to a {@link Sql} fragment.
 * When `columnPos` is true, bare strings are treated as column identifiers.
 */
export function compileExpr(e: unknown, columnPos = false): Sql {
  if (isColRef(e)) {
    return columnIdent(e.col);
  }
  if (isQuery(e)) {
    return sql`(${compileSubquery(e)})`;
  }
  if (Array.isArray(e)) {
    assert.ok(e.length >= 1, 'honey: op call needs an operator', { e });
    assert.string(e[0], 'honey: operator must be a string', { op: e[0] });
    return compileOpCall(e as unknown as OpCall);
  }
  if (typeof e === 'string' && columnPos) {
    return columnIdent(e);
  }
  if (isScalar(e)) {
    return sql`${e}`;
  }
  assert.fail('honey: cannot compile expression', { e });
}

function compileOpCall(call: OpCall): Sql {
  assert.ok(call.length >= 1, 'honey: op call needs an operator', { call });
  const op = call[0];
  assert.string(op, 'honey: operator must be a string', { op });
  const o = op.toLowerCase();
  const args = call.slice(1);

  if (LOGIC.has(o)) {
    return compileLogic(o, args);
  }
  if (INFIX.has(o)) {
    return compileInfix(o, args);
  }
  if (FUNCTIONS.has(o)) {
    return compileFunction(o, args);
  }
  return compileKeywordOp(o, args);
}

function compileKeywordOp(o: string, args: readonly unknown[]): Sql {
  const compiler = KEYWORD_COMPILERS[o];
  assert.defined(compiler, 'honey: unknown operator', { op: o });
  return compiler(args);
}

const KEYWORD_COMPILERS: Record<
  string,
  (args: readonly unknown[]) => Sql
> = {
  not: compileNot,
  in: (args) => compileIn('in', args),
  'not-in': (args) => compileIn('not-in', args),
  between: compileBetween,
  'is-null': (args) => compileIsNull(args, false),
  'is-not-null': (args) => compileIsNull(args, true),
  exists: compileExists,
  cast: compileCast,
  case: compileCase,
  param: compileParam,
};

function compileCast(args: readonly unknown[]): Sql {
  assert.equals(args.length, 2, "honey: 'cast' needs [expr, type]", {
    argsLength: args.length,
  });
  const type = args[1];
  assert.string(type, 'honey: cast type must be a string', { type });
  const t = type.toLowerCase();
  assert.ok(CAST_TYPES.has(t), 'honey: unknown cast type', { type });
  return sql`${compileExpr(args[0])}::${raw(t)}`;
}

/** Force a scalar bind even inside column-position function args. */
function compileParam(args: readonly unknown[]): Sql {
  assert.equals(args.length, 1, "honey: 'param' needs 1 value", {
    argsLength: args.length,
  });
  const v = args[0];
  assert.ok(isScalar(v), 'honey: param value must be a scalar', { v });
  return sql`${v}`;
}

/**
 * `['case', [[pred, then], ...], else?]` → `CASE WHEN … THEN … ELSE … END`.
 */
function compileCase(args: readonly unknown[]): Sql {
  assert.ok(args.length >= 1, "honey: 'case' needs clause list", {
    argsLength: args.length,
  });
  const clauses = args[0];
  assert.ok(Array.isArray(clauses) && clauses.length > 0, 'honey: empty case');
  let out: Sql = raw('CASE');
  for (const clause of clauses) {
    assert.ok(Array.isArray(clause) && clause.length === 2, 'honey: bad case clause', {
      clause,
    });
    out = sql`${out} WHEN ${compileExpr(clause[0])} THEN ${compileExpr(clause[1])}`;
  }
  if (args.length >= 2) {
    out = sql`${out} ELSE ${compileExpr(args[1])}`;
  }
  return sql`${out} END`;
}

function compileLogic(op: string, args: readonly unknown[]): Sql {
  assert.ok(args.length > 0, `honey: empty ${op}`, { op, args });
  const sep = ` ${op.toUpperCase()} `;
  return sql`(${join(
    args.map((a) => compileExpr(a)),
    sep
  )})`;
}

function compileInfix(op: string, args: readonly unknown[]): Sql {
  assert.equals(args.length, 2, `honey: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const left = compileExpr(args[0], true);
  const right = compileExpr(args[1]);
  return sql`${left} ${raw(op.toUpperCase())} ${right}`;
}

function compileNot(args: readonly unknown[]): Sql {
  assert.equals(args.length, 1, "honey: 'not' needs 1 arg", {
    argsLength: args.length,
  });
  return sql`NOT ${compileExpr(args[0])}`;
}

function compileIn(op: 'in' | 'not-in', args: readonly unknown[]): Sql {
  assert.equals(args.length, 2, `honey: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const col = compileExpr(args[0], true);
  const vals = args[1];
  const kw = op === 'in' ? 'IN' : 'NOT IN';

  if (isQuery(vals)) {
    return sql`${col} ${raw(kw)} (${compileSubquery(vals)})`;
  }
  if (!Array.isArray(vals) || vals.length === 0) {
    return op === 'in' ? raw('1 = 0') : raw('1 = 1');
  }
  return sql`${col} ${raw(kw)} (${join(
    vals.map((v) => compileExpr(v)),
    HONEY_LIST_SEP
  )})`;
}

function compileBetween(args: readonly unknown[]): Sql {
  assert.equals(args.length, 3, "honey: 'between' needs 3 args", {
    argsLength: args.length,
  });
  return sql`${compileExpr(args[0], true)} BETWEEN ${compileExpr(args[1])} AND ${compileExpr(args[2])}`;
}

function compileIsNull(args: readonly unknown[], not: boolean): Sql {
  assert.equals(args.length, 1, 'honey: is-null needs 1 arg', {
    argsLength: args.length,
  });
  const kw = not ? 'IS NOT NULL' : 'IS NULL';
  return sql`${compileExpr(args[0], true)} ${raw(kw)}`;
}

function compileExists(args: readonly unknown[]): Sql {
  assert.equals(args.length, 1, "honey: 'exists' needs 1 arg", {
    argsLength: args.length,
  });
  return sql`EXISTS ${compileExpr(args[0])}`;
}

function compileFunction(name: string, args: readonly unknown[]): Sql {
  const fn = name.toUpperCase();
  if (args.length === 0) {
    return raw(`${fn}()`);
  }
  return sql`${raw(fn)}(${join(
    args.map((a) => compileExpr(a, true)),
    HONEY_LIST_SEP
  )})`;
}
