import { assert } from '@pkgs/assert';

import { columnIdent } from './honey-ident';
import { HONEY_LIST_SEP } from './honey-list-sep';
import sql, { join, raw, type Sql } from './sql';

/**
 * Context passed to registered honey op/fn compilers.
 * Always use {@link HoneyCompileCtx.compileExpr} for nested expressions.
 */
export type HoneyCompileCtx = {
  readonly compileExpr: (e: unknown, columnPos?: boolean) => Sql;
};

/** Compiler for a registered operator or function. */
export type HoneyOpCompiler = (
  args: readonly unknown[],
  ctx: HoneyCompileCtx
) => Sql;

const ops = new Map<string, HoneyOpCompiler>();
const fns = new Map<string, HoneyOpCompiler>();
const casts = new Set<string>();
const collations = new Set<string>();

/** Snapshot of built-in names so {@link resetHoneyRegistry} can restore them. */
let builtinsRegistered = false;
const builtinOps = new Set<string>();
const builtinFns = new Set<string>();
const builtinCasts = new Set<string>();
const builtinCollations = new Set<string>();

function normalizeName(name: string, what: string): string {
  assert.string(name, `honey: ${what} name must be a string`, { name });
  assert.ok(name.length > 0, `honey: ${what} name must be non-empty`, { name });
  return name.toLowerCase();
}

/**
 * Register (or replace) a honey operator / keyword op.
 * Names are matched case-insensitively.
 */
export function registerHoneyOp(name: string, compile: HoneyOpCompiler): void {
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
export function registerHoneyFn(name: string, compile?: HoneyOpCompiler): void {
  const key = normalizeName(name, 'fn');
  fns.set(key, compile ?? defaultFnCompiler(key));
  if (!builtinsRegistered) {
    builtinFns.add(key);
  }
}

/**
 * Allowlist a cast target type (`expr::type`).
 */
export function registerHoneyCast(type: string): void {
  const key = normalizeName(type, 'cast');
  assert.ok(/^[a-z][a-z0-9_]*$/.test(key), 'honey: invalid cast type', {
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
export function registerHoneyCollation(name: string): void {
  const key = normalizeName(name, 'collation');
  assert.ok(/^[a-z][a-z0-9_]*$/.test(key), 'honey: invalid collation', {
    name,
  });
  collations.add(key);
  if (!builtinsRegistered) {
    builtinCollations.add(key);
  }
}

/** Mark that built-in registration has finished (for reset bookkeeping). */
export function markHoneyBuiltinsRegistered(): void {
  builtinsRegistered = true;
}

export function lookupHoneyOp(name: string): HoneyOpCompiler | undefined {
  return ops.get(name.toLowerCase());
}

export function lookupHoneyFn(name: string): HoneyOpCompiler | undefined {
  return fns.get(name.toLowerCase());
}

export function isHoneyCastType(type: string): boolean {
  return casts.has(type.toLowerCase());
}

export function isHoneyCollation(name: string): boolean {
  return collations.has(name.toLowerCase());
}

export function isRegisteredHoneyHead(name: string): boolean {
  const key = name.toLowerCase();
  return ops.has(key) || fns.has(key);
}

/**
 * Remove non-builtin registrations (keeps built-ins). For tests.
 */
export function resetHoneyRegistry(): void {
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

function defaultFnCompiler(name: string): HoneyOpCompiler {
  const rendered = renderFnName(name);
  return (args, ctx) => {
    if (args.length === 0) {
      return raw(`${rendered}()`);
    }
    return sql`${raw(rendered)}(${join(
      args.map((a) => ctx.compileExpr(a, true)),
      HONEY_LIST_SEP
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
