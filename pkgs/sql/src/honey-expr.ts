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
]);

/** True when `head` is a known operator or function name (select-item disambiguation). */
export function isOpOrFnHead(head: unknown): boolean {
  if (typeof head !== 'string') {
    return false;
  }
  const o = head.toLowerCase();
  return INFIX.has(o) || LOGIC.has(o) || FUNCTIONS.has(o);
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

export function isQuery(x: unknown): x is Query {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    !(x instanceof Date) &&
    ('select' in x || 'insertInto' in x || 'update' in x || 'deleteFrom' in x)
  );
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
  switch (o) {
    case 'not':
      return compileNot(args);
    case 'in':
    case 'not-in':
      return compileIn(o, args);
    case 'between':
      return compileBetween(args);
    case 'is-null':
      return compileIsNull(args, false);
    case 'is-not-null':
      return compileIsNull(args, true);
    case 'exists':
      return compileExists(args);
    default:
      assert.fail('honey: unknown operator', { op: o });
  }
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
