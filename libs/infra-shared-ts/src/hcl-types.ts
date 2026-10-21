/**
 * Variable type constraints, as far as they change a value: `optional(t,
 * default)` fills missing object attributes (null, or the default), and
 * collections convert element-wise. Anything else passes through.
 */

import type { Expr } from './hcl-ast';
import type { Env } from './hcl-eval';
import { evaluate } from './hcl-eval';
import type { Value } from './hcl-value';
import { defineLazy, isList, isObject, isUnknown } from './hcl-value';

type Optional = { readonly type: Expr; readonly fallback: Value | undefined };

function optionalOf(expr: Expr, env: Env): Optional | null {
  if (expr.kind !== 'call' || expr.name !== 'optional') return null;
  const [type, fallback] = expr.args;
  if (type === undefined) return null;
  return {
    type,
    fallback: fallback === undefined ? undefined : evaluate(fallback, env),
  };
}

function convertObject(
  attrs: Extract<Expr, { kind: 'object' }>,
  value: { readonly [key: string]: Value },
  env: Env
): Value {
  const out: Record<string, Value> = {};
  for (const entry of attrs.entries) {
    const key = entry.key.kind === 'literal' ? String(entry.key.value) : null;
    if (key === null) continue;
    const opt = optionalOf(entry.value, env);
    const typeExpr = opt === null ? entry.value : opt.type;
    const present = (value as Record<string, Value>)[key];
    if (present === undefined || present === null) {
      defineLazy(out, key, () =>
        opt === null ? null : (opt.fallback ?? null)
      );
      continue;
    }
    defineLazy(out, key, () => convertToType(typeExpr, present, env));
  }
  for (const key of Object.keys(value)) {
    if (!(key in out)) {
      const kept = (value as Record<string, Value>)[key] as Value;
      defineLazy(out, key, () => kept);
    }
  }
  return out;
}

export function convertToType(type: Expr, value: Value, env: Env): Value {
  if (isUnknown(value) || value === null || type.kind !== 'call') return value;
  const [inner] = type.args;
  if (type.name === 'object' && inner?.kind === 'object' && isObject(value)) {
    return convertObject(inner, value, env);
  }
  const elementWise = ['list', 'set', 'tuple'].includes(type.name);
  if (elementWise && inner !== undefined && isList(value)) {
    return value.map((item) => convertToType(inner, item, env));
  }
  if (type.name === 'map' && inner !== undefined && isObject(value)) {
    const out: Record<string, Value> = {};
    for (const key of Object.keys(value)) {
      const item = (value as Record<string, Value>)[key] as Value;
      defineLazy(out, key, () => convertToType(inner, item, env));
    }
    return out;
  }
  return value;
}
