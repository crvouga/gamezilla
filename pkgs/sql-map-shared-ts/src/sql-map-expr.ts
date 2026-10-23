import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { ensureSqlMapBuiltins } from './sql-map-builtins';
import { columnIdent } from './sql-map-ident';
import type { SqlMapCompileCtx } from './sql-map-registry';
import {
  isRegisteredSqlMapHead,
  lookupSqlMapFn,
  lookupSqlMapOp,
} from './sql-map-registry';
import type { ColRef, OpCall, Query, Scalar } from './sql-map-types';

ensureSqlMapBuiltins();

/** True when `head` is a known operator or function name (select-item disambiguation). */
export function isOpOrFnHead(head: unknown): boolean {
  if (typeof head !== 'string') {
    return false;
  }
  return isRegisteredSqlMapHead(head);
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
  assert.defined(compileQueryFn, 'sqlMap: compileQuery not wired');
  return compileQueryFn(q);
}

const compileCtx: SqlMapCompileCtx = {
  compileExpr: (e, columnPos) => compileExpr(e, columnPos),
};

/**
 * Compiles any expression to a {@link Sql} fragment.
 * When `columnPos` is true, bare strings are treated as column identifiers.
 */
export function compileExpr(e: unknown, columnPos = false): Sql {
  if (isColRef(e)) {
    return columnIdent(e.col);
  }
  if (isQuery(e)) {
    return sql<void>`(${compileSubquery(e)})`;
  }
  if (Array.isArray(e)) {
    assert.ok(e.length >= 1, 'sqlMap: op call needs an operator', { e });
    assert.string(e[0], 'sqlMap: operator must be a string', { op: e[0] });
    return compileOpCall(e as unknown as OpCall);
  }
  if (typeof e === 'string' && columnPos) {
    return columnIdent(e);
  }
  if (isScalar(e)) {
    return sql<void>`${e}`;
  }
  assert.fail('sqlMap: cannot compile expression', { e });
}

function compileOpCall(call: OpCall): Sql {
  assert.ok(call.length >= 1, 'sqlMap: op call needs an operator', { call });
  const op = call[0];
  assert.string(op, 'sqlMap: operator must be a string', { op });
  const o = op.toLowerCase();
  const args = call.slice(1);

  const opCompiler = lookupSqlMapOp(o);
  if (opCompiler) {
    return opCompiler(args, compileCtx);
  }
  const fnCompiler = lookupSqlMapFn(o);
  if (fnCompiler) {
    return fnCompiler(args, compileCtx);
  }
  assert.fail('sqlMap: unknown operator', { op: o });
}
