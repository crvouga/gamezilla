import { assert } from '@pkgs/assert';

import { HONEY_LIST_SEP } from './honey-list-sep';
import {
  isHoneyCastType,
  markHoneyBuiltinsRegistered,
  registerHoneyCast,
  registerHoneyCollation,
  registerHoneyFn,
  registerHoneyOp,
  type HoneyCompileCtx,
  type HoneyOpCompiler,
} from './honey-registry';
import sql, { join, raw, type Sql } from './sql';

const INTERVAL_RE =
  /^[0-9]+ (day|days|hour|hours|minute|minutes|second|seconds|week|weeks|month|months|year|years)$/i;

let didRegister = false;

/** Registers all built-in honey ops, fns, casts, and collations (idempotent). */
export function ensureHoneyBuiltins(): void {
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
  registerHoneyCollation('NOCASE');
  markHoneyBuiltinsRegistered();
}

function registerInfixOps(): void {
  for (const op of [
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
  ]) {
    registerHoneyOp(op, (args, ctx) => compileInfix(op, args, ctx));
  }
  registerHoneyOp('like', compileLike);
  registerHoneyOp('not-like', (args, ctx) => compileLike(args, ctx, true));
}

function registerLogicOps(): void {
  registerHoneyOp('and', (args, ctx) => compileLogic('and', args, ctx));
  registerHoneyOp('or', (args, ctx) => compileLogic('or', args, ctx));
}

function registerKeywordOps(): void {
  registerHoneyOp('not', compileNot);
  registerHoneyOp('in', (args, ctx) => compileIn('in', args, ctx));
  registerHoneyOp('not-in', (args, ctx) => compileIn('not-in', args, ctx));
  registerHoneyOp('between', compileBetween);
  registerHoneyOp('is-null', (args, ctx) => compileIsNull(args, ctx, false));
  registerHoneyOp('is-not-null', (args, ctx) => compileIsNull(args, ctx, true));
  registerHoneyOp('exists', compileExists);
  registerHoneyOp('cast', compileCast);
  registerHoneyOp('case', compileCase);
  registerHoneyOp('param', compileParam);
}

function registerExtraOps(): void {
  registerHoneyOp('||', compileConcat);
  registerHoneyOp('->', (args, ctx) => compileJsonArrow(args, ctx, '->'));
  registerHoneyOp('->>', (args, ctx) => compileJsonArrow(args, ctx, '->>'));
  registerHoneyOp('tuple', compileTuple);
  registerHoneyOp('interval', compileInterval);
}

function registerBuiltinFns(): void {
  for (const fn of [
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
    'current_schema',
  ]) {
    registerHoneyFn(fn);
  }
}

function registerBuiltinCasts(): void {
  for (const t of [
    'text',
    'jsonb',
    'int',
    'bigint',
    'uuid',
    'boolean',
    'timestamptz',
    'integer',
  ]) {
    registerHoneyCast(t);
  }
}

function compileLogic(
  op: string,
  args: readonly unknown[],
  ctx: HoneyCompileCtx
): Sql {
  assert.ok(args.length > 0, `honey: empty ${op}`, { op, args });
  const sep = ` ${op.toUpperCase()} `;
  return sql`(${join(
    args.map((a) => ctx.compileExpr(a)),
    sep
  )})`;
}

function compileInfix(
  op: string,
  args: readonly unknown[],
  ctx: HoneyCompileCtx
): Sql {
  assert.equals(args.length, 2, `honey: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const left = ctx.compileExpr(args[0], true);
  const right = ctx.compileExpr(args[1]);
  return sql`${left} ${raw(op.toUpperCase())} ${right}`;
}

function compileLike(
  args: readonly unknown[],
  ctx: HoneyCompileCtx,
  not = false
): Sql {
  assert.ok(
    args.length === 2 || args.length === 3,
    `honey: '${not ? 'not-like' : 'like'}' needs 2 or 3 args`,
    { argsLength: args.length }
  );
  const left = ctx.compileExpr(args[0], true);
  const pattern = ctx.compileExpr(args[1]);
  const kw = not ? 'NOT LIKE' : 'LIKE';
  if (args.length === 2) {
    return sql`${left} ${raw(kw)} ${pattern}`;
  }
  const esc = parseEscape(args[2]);
  return sql`${left} ${raw(kw)} ${pattern} ESCAPE ${ctx.compileExpr(esc)}`;
}

function parseEscape(arg: unknown): string {
  if (Array.isArray(arg) && arg[0] === 'escape') {
    assert.equals(arg.length, 2, "honey: 'escape' needs 1 value");
    assert.string(arg[1], 'honey: escape char must be a string');
    return arg[1];
  }
  assert.string(arg, 'honey: like escape must be a string or [escape, char]');
  return arg;
}

function compileNot(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 1, "honey: 'not' needs 1 arg", {
    argsLength: args.length,
  });
  return sql`NOT ${ctx.compileExpr(args[0])}`;
}

function compileIn(
  op: 'in' | 'not-in',
  args: readonly unknown[],
  ctx: HoneyCompileCtx
): Sql {
  assert.equals(args.length, 2, `honey: '${op}' needs 2 args`, {
    op,
    argsLength: args.length,
  });
  const col = ctx.compileExpr(args[0], true);
  const vals = args[1];
  const kw = op === 'in' ? 'IN' : 'NOT IN';

  if (isQueryMap(vals)) {
    return sql`${col} ${raw(kw)} ${ctx.compileExpr(vals)}`;
  }
  if (!Array.isArray(vals) || vals.length === 0) {
    return op === 'in' ? raw('1 = 0') : raw('1 = 1');
  }
  return sql`${col} ${raw(kw)} (${join(
    vals.map((v) => ctx.compileExpr(v)),
    HONEY_LIST_SEP
  )})`;
}

function compileBetween(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 3, "honey: 'between' needs 3 args", {
    argsLength: args.length,
  });
  return sql`${ctx.compileExpr(args[0], true)} BETWEEN ${ctx.compileExpr(args[1])} AND ${ctx.compileExpr(args[2])}`;
}

function compileIsNull(
  args: readonly unknown[],
  ctx: HoneyCompileCtx,
  not: boolean
): Sql {
  assert.equals(args.length, 1, 'honey: is-null needs 1 arg', {
    argsLength: args.length,
  });
  const kw = not ? 'IS NOT NULL' : 'IS NULL';
  return sql`${ctx.compileExpr(args[0], true)} ${raw(kw)}`;
}

function compileExists(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 1, "honey: 'exists' needs 1 arg", {
    argsLength: args.length,
  });
  return sql`EXISTS ${ctx.compileExpr(args[0])}`;
}

function compileCast(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 2, "honey: 'cast' needs [expr, type]", {
    argsLength: args.length,
  });
  const type = args[1];
  assert.string(type, 'honey: cast type must be a string', { type });
  const t = type.toLowerCase();
  assert.ok(isHoneyCastType(t), 'honey: unknown cast type', { type });
  return sql`${ctx.compileExpr(args[0])}::${raw(t)}`;
}

function compileParam(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 1, "honey: 'param' needs 1 value", {
    argsLength: args.length,
  });
  const v = args[0];
  assert.ok(
    v === null ||
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v instanceof Date,
    'honey: param value must be a scalar',
    { v }
  );
  return ctx.compileExpr(v, false);
}

function compileCase(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.ok(args.length >= 1, "honey: 'case' needs clause list", {
    argsLength: args.length,
  });
  const clauses = args[0];
  assert.ok(Array.isArray(clauses) && clauses.length > 0, 'honey: empty case');
  let out: Sql = raw('CASE');
  for (const clause of clauses) {
    assert.ok(
      Array.isArray(clause) && clause.length === 2,
      'honey: bad case clause',
      { clause }
    );
    out = sql`${out} WHEN ${ctx.compileExpr(clause[0])} THEN ${ctx.compileExpr(clause[1])}`;
  }
  if (args.length >= 2) {
    out = sql`${out} ELSE ${ctx.compileExpr(args[1])}`;
  }
  return sql`${out} END`;
}

function compileConcat(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.ok(args.length >= 2, "honey: '||' needs ≥2 args", {
    argsLength: args.length,
  });
  return join(
    args.map((a) => ctx.compileExpr(a)),
    ' || '
  );
}

function compileJsonArrow(
  args: readonly unknown[],
  ctx: HoneyCompileCtx,
  op: '->' | '->>'
): Sql {
  assert.equals(args.length, 2, `honey: '${op}' needs 2 args`, {
    argsLength: args.length,
  });
  return sql`${ctx.compileExpr(args[0], true)} ${raw(op)} ${ctx.compileExpr(args[1])}`;
}

function compileTuple(args: readonly unknown[], ctx: HoneyCompileCtx): Sql {
  assert.ok(args.length >= 1, "honey: 'tuple' needs ≥1 args");
  return sql`(${join(
    args.map((a) => ctx.compileExpr(a, true)),
    HONEY_LIST_SEP
  )})`;
}

function compileInterval(args: readonly unknown[], _ctx: HoneyCompileCtx): Sql {
  assert.equals(args.length, 1, "honey: 'interval' needs 1 string", {
    argsLength: args.length,
  });
  const lit = args[0];
  assert.string(lit, 'honey: interval literal must be a string', { lit });
  assert.ok(INTERVAL_RE.test(lit), 'honey: bad interval literal', { lit });
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

/** Re-export for callers that need a typed no-op compiler slot. */
export type { HoneyOpCompiler };
