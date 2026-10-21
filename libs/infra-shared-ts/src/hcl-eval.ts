/**
 * Static evaluation of HCL expressions. There is no provider, no state and no
 * network, so anything a provider computes (ids, ARNs, endpoints) is
 * `UNKNOWN`, and `UNKNOWN` propagates through operators and functions —
 * exactly like a plan-time unknown. Everything declared in configuration and
 * tfvars (names, hostnames, instance keys, counts) evaluates to a real value.
 *
 * Objects may carry lazy getters, so a module's variables, locals, outputs
 * and resource attributes are evaluated only when something reads them.
 */

import type { Expr } from './hcl-ast';
import { callFunction } from './hcl-functions';
import type { Value } from './hcl-value';
import {
  defineLazy,
  EvalError,
  isList,
  isObject,
  isUnknown,
  sortedKeys,
  stringify,
  truthy,
  UNKNOWN,
} from './hcl-value';
import type { SourceFiles } from './infra-source';

export type Env = {
  readonly names: Readonly<Record<string, Value>>;
  readonly files: SourceFiles;
};

/** Evaluate, converting any evaluation failure into UNKNOWN. */
export function evaluate(expr: Expr, env: Env): Value {
  try {
    return ev(expr, env);
  } catch (error) {
    if (error instanceof EvalError || error instanceof TypeError) {
      return UNKNOWN;
    }
    throw error;
  }
}

function ev(expr: Expr, env: Env): Value {
  switch (expr.kind) {
    case 'literal':
      return expr.value;
    case 'name':
      return rootName(expr.name, env);
    case 'template':
      return evalTemplate(expr.parts, env);
    case 'attr':
      return getAttr(ev(expr.target, env), expr.name);
    case 'index':
      return getIndex(ev(expr.target, env), ev(expr.key, env));
    case 'splat':
      return evalSplat(expr, env);
    case 'call':
      return evalCall(expr, env);
    case 'unary':
      return evalUnary(expr, env);
    case 'binary':
      return evalBinary(expr, env);
    case 'conditional':
      return evalConditional(expr, env);
    case 'tuple':
      return expr.items.map((item) => ev(item, env));
    case 'object':
      return evalObject(expr, env);
    case 'for':
      return evalFor(expr, env);
  }
}

function rootName(name: string, env: Env): Value {
  const value = env.names[name];
  if (value === undefined) return UNKNOWN;
  return value;
}

function evalTemplate(parts: readonly (string | Expr)[], env: Env): Value {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') {
      out += part;
      continue;
    }
    const value = ev(part, env);
    if (isUnknown(value)) return UNKNOWN;
    out += stringify(value);
  }
  return out;
}

export function getAttr(target: Value, name: string): Value {
  if (isUnknown(target)) return UNKNOWN;
  if (isObject(target)) {
    const found = (target as Record<string, Value>)[name];
    return found === undefined ? UNKNOWN : found;
  }
  if (isList(target) && /^\d+$/.test(name)) {
    return target[Number(name)] ?? UNKNOWN;
  }
  return UNKNOWN;
}

function getIndex(target: Value, key: Value): Value {
  if (isUnknown(target) || isUnknown(key)) return UNKNOWN;
  if (isList(target)) {
    const found = target[Number(key)];
    return found === undefined ? UNKNOWN : found;
  }
  if (isObject(target)) return getAttr(target, stringify(key));
  return UNKNOWN;
}

function evalSplat(expr: Extract<Expr, { kind: 'splat' }>, env: Env): Value {
  const target = ev(expr.target, env);
  if (isUnknown(target)) return UNKNOWN;
  const items = isList(target) ? target : target === null ? [] : [target];
  return items.map((item) => {
    let cur: Value = item;
    for (const step of expr.path) {
      cur =
        step.kind === 'attr'
          ? getAttr(cur, step.name)
          : getIndex(cur, ev(step.key, env));
    }
    return cur;
  });
}

function evalCall(expr: Extract<Expr, { kind: 'call' }>, env: Env): Value {
  if (expr.name === 'try') {
    for (const arg of expr.args) {
      try {
        return ev(arg, env);
      } catch (error) {
        if (!(error instanceof EvalError || error instanceof TypeError)) {
          throw error;
        }
      }
    }
    return UNKNOWN;
  }
  const args = expr.args.map((arg) => ev(arg, env));
  return callFunction(expr.name, args, env.files);
}

function evalUnary(expr: Extract<Expr, { kind: 'unary' }>, env: Env): Value {
  const value = ev(expr.operand, env);
  if (isUnknown(value)) return UNKNOWN;
  if (expr.op === '!') return !truthy(value);
  return -Number(value);
}

function looseEquals(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null
  ) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function evalBinary(expr: Extract<Expr, { kind: 'binary' }>, env: Env): Value {
  if (expr.op === '&&' || expr.op === '||') {
    return evalLogical(expr, env);
  }
  const left = ev(expr.left, env);
  const right = ev(expr.right, env);
  if (isUnknown(left) || isUnknown(right)) return UNKNOWN;
  return arithmetic(expr.op, left, right);
}

/** Short-circuit logic that stays decided when the other side is unknown. */
function evalLogical(expr: Extract<Expr, { kind: 'binary' }>, env: Env): Value {
  const decisive = expr.op === '||';
  const left = ev(expr.left, env);
  if (!isUnknown(left) && truthy(left) === decisive) return decisive;
  const right = ev(expr.right, env);
  if (!isUnknown(right) && truthy(right) === decisive) return decisive;
  if (isUnknown(left) || isUnknown(right)) return UNKNOWN;
  return !decisive;
}

function arithmetic(op: string, left: Value, right: Value): Value {
  if (op === '==') return looseEquals(left, right);
  if (op === '!=') return !looseEquals(left, right);
  const a = Number(left);
  const b = Number(right);
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    case '%':
      return a % b;
    case '<':
      return a < b;
    case '>':
      return a > b;
    case '<=':
      return a <= b;
    case '>=':
      return a >= b;
    default:
      throw new EvalError(`unsupported operator ${op}`);
  }
}

function evalConditional(
  expr: Extract<Expr, { kind: 'conditional' }>,
  env: Env
): Value {
  const test = ev(expr.test, env);
  if (isUnknown(test)) return UNKNOWN;
  return ev(truthy(test) ? expr.then : expr.otherwise, env);
}

function objectKey(value: Value): string {
  if (isUnknown(value)) throw new EvalError('unknown object key');
  return stringify(value);
}

function evalObject(expr: Extract<Expr, { kind: 'object' }>, env: Env): Value {
  const out: Record<string, Value> = {};
  for (const entry of expr.entries) {
    const key = objectKey(ev(entry.key, env));
    defineLazy(out, key, () => ev(entry.value, env));
  }
  return out;
}

function entriesOf(collection: Value): [Value, Value][] {
  if (isList(collection)) {
    return collection.map((item, index): [Value, Value] => [index, item]);
  }
  if (isObject(collection)) {
    return sortedKeys(collection).map((key): [Value, Value] => [
      key,
      (collection as Record<string, Value>)[key] as Value,
    ]);
  }
  throw new EvalError('cannot iterate over a non-collection');
}

function evalFor(expr: Extract<Expr, { kind: 'for' }>, env: Env): Value {
  const collection = ev(expr.collection, env);
  if (isUnknown(collection)) return UNKNOWN;
  const list: Value[] = [];
  const map: Record<string, Value> = {};
  for (const [key, item] of entriesOf(collection)) {
    const names: Record<string, Value> = {
      ...env.names,
      [expr.valueVar]: item,
    };
    if (expr.keyVar !== null) names[expr.keyVar] = key;
    const inner: Env = { names, files: env.files };
    if (expr.condition !== null) {
      const keep = ev(expr.condition, inner);
      if (isUnknown(keep)) return UNKNOWN;
      if (!truthy(keep)) continue;
    }
    if (!expr.asObject) {
      list.push(ev(expr.valueExpr, inner));
      continue;
    }
    const mapKey = objectKey(ev(expr.keyExpr as Expr, inner));
    defineLazy(map, mapKey, () => ev(expr.valueExpr, inner));
  }
  return expr.asObject ? map : list;
}
