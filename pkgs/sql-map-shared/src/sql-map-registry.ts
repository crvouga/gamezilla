import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql, { join, raw } from '@pkgs/sql-root-shared/sql';
import { columnIdent } from './sql-map-ident';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';

/**
 * Context passed to registered sql-map op/fn compilers.
 * Always use {@link SqlMapCompileCtx.compileExpr} for nested expressions.
 */
export type SqlMapCompileCtx = {
  readonly compileExpr: (e: unknown, columnPos?: boolean) => Sql;
};

/** Compiler for a registered operator or function. */
export type SqlMapOpCompiler = (
  args: readonly unknown[],
  ctx: SqlMapCompileCtx
) => Sql;

const ops = new Map<string, SqlMapOpCompiler>();
const fns = new Map<string, SqlMapOpCompiler>();
const casts = new Set<string>();
const collations = new Set<string>();

/** Snapshot of built-in names so {@link resetSqlMapRegistry} can restore them. */
let builtinsRegistered = false;
const builtinOps = new Set<string>();
const builtinFns = new Set<string>();
const builtinCasts = new Set<string>();
const builtinCollations = new Set<string>();

function normalizeName(name: string, what: string): string {
  assert.string(name, `sqlMap: ${what} name must be a string`, { name });
  assert.ok(name.length > 0, `sqlMap: ${what} name must be non-empty`, {
    name,
  });
  return name.toLowerCase();
}

/**
 * Register (or replace) a sql-map operator / keyword op.
 * Names are matched case-insensitively.
 */
export function registerSqlMapOp(
  name: string,
  compile: SqlMapOpCompiler
): void {
  const key = normalizeName(name, 'op');
  ops.set(key, compile);
  if (!builtinsRegistered) {
    builtinOps.add(key);
  }
}

/**
 * Register a SQL function. When `compile` is omitted, emits `NAME(args…)`
 * with args compiled in column position (strings → identifiers).
 *
 * Dotted names like `cron.schedule` are allowed (validated via {@link columnIdent}).
 */
export function registerSqlMapFn(
  name: string,
  compile?: SqlMapOpCompiler
): void {
  const key = normalizeName(name, 'fn');
  fns.set(key, compile ?? defaultFnCompiler(key));
  if (!builtinsRegistered) {
    builtinFns.add(key);
  }
}

/**
 * Allowlist a cast target type (`expr::type`).
 */
export function registerSqlMapCast(type: string): void {
  const key = normalizeName(type, 'cast');
  assert.ok(/^[a-z][a-z0-9_]*$/.test(key), 'sqlMap: invalid cast type', {
    type,
  });
  casts.add(key);
  if (!builtinsRegistered) {
    builtinCasts.add(key);
  }
}

/**
 * Allowlist an ORDER BY COLLATE name (e.g. `NOCASE`).
 */
export function registerSqlMapCollation(name: string): void {
  const key = normalizeName(name, 'collation');
  assert.ok(/^[a-z][a-z0-9_]*$/.test(key), 'sqlMap: invalid collation', {
    name,
  });
  collations.add(key);
  if (!builtinsRegistered) {
    builtinCollations.add(key);
  }
}

/** Mark that built-in registration has finished (for reset bookkeeping). */
export function markSqlMapBuiltinsRegistered(): void {
  builtinsRegistered = true;
}

export function lookupSqlMapOp(name: string): SqlMapOpCompiler | undefined {
  return ops.get(name.toLowerCase());
}

export function lookupSqlMapFn(name: string): SqlMapOpCompiler | undefined {
  return fns.get(name.toLowerCase());
}

export function isSqlMapCastType(type: string): boolean {
  return casts.has(type.toLowerCase());
}

export function isSqlMapCollation(name: string): boolean {
  return collations.has(name.toLowerCase());
}

export function isRegisteredSqlMapHead(name: string): boolean {
  const key = name.toLowerCase();
  return ops.has(key) || fns.has(key);
}

/**
 * Remove non-builtin registrations (keeps built-ins). For tests.
 */
export function resetSqlMapRegistry(): void {
  for (const key of [...ops.keys()]) {
    if (!builtinOps.has(key)) {
      ops.delete(key);
    }
  }
  for (const key of [...fns.keys()]) {
    if (!builtinFns.has(key)) {
      fns.delete(key);
    }
  }
  for (const key of [...casts]) {
    if (!builtinCasts.has(key)) {
      casts.delete(key);
    }
  }
  for (const key of [...collations]) {
    if (!builtinCollations.has(key)) {
      collations.delete(key);
    }
  }
}

function defaultFnCompiler(name: string): SqlMapOpCompiler {
  const rendered = renderFnName(name);
  return (args, ctx) => {
    if (args.length === 0) {
      return raw(`${rendered}()`);
    }
    return sql<void>`${raw(rendered)}(${join(
      args.map((a) => ctx.compileExpr(a, true)),
      SQL_MAP_LIST_SEP
    )})`;
  };
}

function renderFnName(name: string): string {
  // Validate path segments (e.g. cron.schedule).
  columnIdent(name);
  return name
    .split('.')
    .map((p) => p.toUpperCase())
    .join('.');
}
