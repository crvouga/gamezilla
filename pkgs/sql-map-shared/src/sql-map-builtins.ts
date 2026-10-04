import { assert } from '@pkgs/assert-shared/singleton';

import sql, { join, raw } from '@pkgs/sql-shared/sql';
import type { Sql } from '@pkgs/sql-shared/sql';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import { isSqlMapCastType, markSqlMapBuiltinsRegistered, registerSqlMapCast, registerSqlMapCollation, registerSqlMapFn, registerSqlMapOp } from './sql-map-registry';
import type { SqlMapCompileCtx, } from './sql-map-registry';

const INTERVAL_RE =
  /^[0-9]+ (day|days|hour|hours|minute|minutes|second|seconds|week|weeks|month|months|year|years)$/i;

let didRegister = false;

/** Registers all built-in sql-map ops, fns, casts, and collations (idempotent). */
export function ensureSqlMapBuiltins(): void {
  if (didRegister) {
    return;
  }
  didRegister = true;
  registerInfixOps();
  registerLogicOps();
  registerKeywordOps();
  registerExtraOps();
  registerBuiltinFns();
  registerBuiltinCasts();
  registerSqlMapCollation('NOCASE');
  markSqlMapBuiltinsRegistered();
}

const INFIX_OPS = [
  '=',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'ilike',
  '+',
  '-',
  '*',
  '/',
];

function registerInfixOps(): void {
  for (const op of INFIX_OPS) {
    registerSqlMapOp(op, (args, ctx) => compileInfix(op, args, ctx));
  }
  registerSqlMapOp('like', compileLike);
  registerSqlMapOp('not-like', (args, ctx) => compileLike(args, ctx, true));
}

function registerLogicOps(): void {
  registerSqlMapOp('and', (args, ctx) => compileLogic('and', args, ctx));
  registerSqlMapOp('or', (args, ctx) => compileLogic('or', args, ctx));
}

function registerKeywordOps(): void {
  registerSqlMapOp('not', compileNot);
  registerSqlMapOp('in', (args, ctx) => compileIn('in', args, ctx));
  registerSqlMapOp('not-in', (args, ctx) => compileIn('not-in', args, ctx));
  registerSqlMapOp('between', compileBetween);
  registerSqlMapOp('is-null', (args, ctx) => compileIsNull(args, ctx, false));
  registerSqlMapOp('is-not-null', (args, ctx) =>
    compileIsNull(args, ctx, true)
  );
  registerSqlMapOp('exists', compileExists);
  registerSqlMapOp('cast', compileCast);
  registerSqlMapOp('case', compileCase);
  registerSqlMapOp('param', compileParam);
}

function registerExtraOps(): void {
  registerSqlMapOp('||', compileConcat);
  registerSqlMapOp('->', (args, ctx) => compileJsonArrow(args, ctx, '->'));
  registerSqlMapOp('->>', (args, ctx) => compileJsonArrow(args, ctx, '->>'));
  registerSqlMapOp('tuple', compileTuple);
  registerSqlMapOp('interval', compileInterval);
}

const BUILTIN_FNS = [
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
  'hashtext',
  'pg_advisory_xact_lock',
  'pg_try_advisory_lock',
  'pg_advisory_unlock',
  'jsonb_to_recordset',
  'current_schema',
];
function registerBuiltinFns(): void {
  for (const fn of BUILTIN_FNS) {
    registerSqlMapFn(fn);
  }
}

const BUILTIN_CASTS = [
  'text',
  'jsonb',
  'int',
  'bigint',
  'uuid',
  'boolean',
  'timestamptz',
  'integer',
];

function registerBuiltinCasts(): void {
  for (const t of BUILTIN_CASTS) {
    registerSqlMapCast(t);
  }
}

function compileLogic(
  op: string,
  args: readonly unknown[],
  ctx: SqlMapCompileCtx
): Sql {
  assert.ok(args.length > 0, `sqlMap: empty ${op}`, { op, args });
  const sep = ` ${op.toUpperCase()} `;
  return sql<void>`(${join(
    args.map((a) => ctx.compileExpr(a)),
    sep
  )})`;
}

function compileInfix(
  op: string,
  args: readonly unknown[],
  ctx: SqlMapCompileCtx
): Sql {
  assert.equals(args.length, 2, `sqlMap: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const left = ctx.compileExpr(args[0], true);
  const right = ctx.compileExpr(args[1]);
  return sql<void>`${left} ${raw(op.toUpperCase())} ${right}`;
}

function compileLike(
  args: readonly unknown[],
  ctx: SqlMapCompileCtx,
  not = false
): Sql {
  assert.ok(
    args.length === 2 || args.length === 3,
    `sqlMap: '${not ? 'not-like' : 'like'}' needs 2 or 3 args`,
    { argsLength: args.length }
  );
  const left = ctx.compileExpr(args[0], true);
  const pattern = ctx.compileExpr(args[1]);
  const kw = not ? 'NOT LIKE' : 'LIKE';
  if (args.length === 2) {
    return sql<void>`${left} ${raw(kw)} ${pattern}`;
  }
  const esc = parseEscape(args[2]);
  return sql<void>`${left} ${raw(kw)} ${pattern} ESCAPE ${ctx.compileExpr(esc)}`;
}

function parseEscape(arg: unknown): string {
  if (Array.isArray(arg) && arg[0] === 'escape') {
    assert.equals(arg.length, 2, "sqlMap: 'escape' needs 1 value");
    assert.string(arg[1], 'sqlMap: escape char must be a string');
    return arg[1];
  }
  assert.string(arg, 'sqlMap: like escape must be a string or [escape, char]');
  return arg;
}

function compileNot(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.equals(args.length, 1, "sqlMap: 'not' needs 1 arg", {
    argsLength: args.length,
  });
  return sql<void>`NOT ${ctx.compileExpr(args[0])}`;
}

function compileIn(
  op: 'in' | 'not-in',
  args: readonly unknown[],
  ctx: SqlMapCompileCtx
): Sql {
  assert.equals(args.length, 2, `sqlMap: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const col = ctx.compileExpr(args[0], true);
  const vals = args[1];
  const kw = op === 'in' ? 'IN' : 'NOT IN';

  if (isQueryMap(vals)) {
    return sql<void>`${col} ${raw(kw)} ${ctx.compileExpr(vals)}`;
  }
  if (!Array.isArray(vals) || vals.length === 0) {
    return op === 'in' ? raw('1 = 0') : raw('1 = 1');
  }
  return sql<void>`${col} ${raw(kw)} (${join(
    vals.map((v) => ctx.compileExpr(v)),
    SQL_MAP_LIST_SEP
  )})`;
}

function compileBetween(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.equals(args.length, 3, "sqlMap: 'between' needs 3 args", {
    argsLength: args.length,
  });
  return sql<void>`${ctx.compileExpr(args[0], true)} BETWEEN ${ctx.compileExpr(args[1])} AND ${ctx.compileExpr(args[2])}`;
}

function compileIsNull(
  args: readonly unknown[],
  ctx: SqlMapCompileCtx,
  not: boolean
): Sql {
  assert.equals(args.length, 1, 'sqlMap: is-null needs 1 arg', {
    argsLength: args.length,
  });
  const kw = not ? 'IS NOT NULL' : 'IS NULL';
  return sql<void>`${ctx.compileExpr(args[0], true)} ${raw(kw)}`;
}

function compileExists(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.equals(args.length, 1, "sqlMap: 'exists' needs 1 arg", {
    argsLength: args.length,
  });
  return sql<void>`EXISTS ${ctx.compileExpr(args[0])}`;
}

function compileCast(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.equals(args.length, 2, "sqlMap: 'cast' needs [expr, type]", {
    argsLength: args.length,
  });
  const type = args[1];
  assert.string(type, 'sqlMap: cast type must be a string', { type });
  const t = type.toLowerCase();
  assert.ok(isSqlMapCastType(t), 'sqlMap: unknown cast type', { type });
  return sql<void>`${ctx.compileExpr(args[0])}::${raw(t)}`;
}

function compileParam(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.equals(args.length, 1, "sqlMap: 'param' needs 1 value", {
    argsLength: args.length,
  });
  const v = args[0];
  assert.ok(
    v === null ||
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v instanceof Date,
    'sqlMap: param value must be a scalar',
    { v }
  );
  return ctx.compileExpr(v, false);
}

function compileCase(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.ok(args.length >= 1, "sqlMap: 'case' needs clause list", {
    argsLength: args.length,
  });
  const clauses = args[0];
  assert.ok(Array.isArray(clauses) && clauses.length > 0, 'sqlMap: empty case');
  let out: Sql = raw('CASE');
  for (const clause of clauses) {
    assert.ok(
      Array.isArray(clause) && clause.length === 2,
      'sqlMap: bad case clause',
      { clause }
    );
    out = sql<void>`${out} WHEN ${ctx.compileExpr(clause[0])} THEN ${ctx.compileExpr(clause[1])}`;
  }
  if (args.length >= 2) {
    out = sql<void>`${out} ELSE ${ctx.compileExpr(args[1])}`;
  }
  return sql<void>`${out} END`;
}

function compileConcat(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.ok(args.length >= 2, "sqlMap: '||' needs ≥2 args", {
    argsLength: args.length,
  });
  return join(
    args.map((a) => ctx.compileExpr(a)),
    ' || '
  );
}

function compileJsonArrow(
  args: readonly unknown[],
  ctx: SqlMapCompileCtx,
  op: '->' | '->>'
): Sql {
  assert.equals(args.length, 2, `sqlMap: '${op}' needs 2 args`, {
    argsLength: args.length,
  });
  return sql<void>`${ctx.compileExpr(args[0], true)} ${raw(op)} ${ctx.compileExpr(args[1])}`;
}

function compileTuple(args: readonly unknown[], ctx: SqlMapCompileCtx): Sql {
  assert.ok(args.length >= 1, "sqlMap: 'tuple' needs ≥1 args");
  return sql<void>`(${join(
    args.map((a) => ctx.compileExpr(a, true)),
    SQL_MAP_LIST_SEP
  )})`;
}

function compileInterval(
  args: readonly unknown[],
  _ctx: SqlMapCompileCtx
): Sql {
  assert.equals(args.length, 1, "sqlMap: 'interval' needs 1 string", {
    argsLength: args.length,
  });
  const lit = args[0];
  assert.string(lit, 'sqlMap: interval literal must be a string', { lit });
  assert.ok(INTERVAL_RE.test(lit), 'sqlMap: bad interval literal', { lit });
  // Splice validated literal only (no user-controlled free SQL).
  return raw(`INTERVAL '${lit}'`);
}

function isQueryMap(x: unknown): boolean {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) {
    return false;
  }
  if (x instanceof Date) {
    return false;
  }
  const keys = [
    'select',
    'from',
    'insertInto',
    'update',
    'deleteFrom',
    'union',
    'unionAll',
  ] as const;
  return keys.some((k) => k in x);
}
