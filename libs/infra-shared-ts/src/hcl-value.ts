/**
 * The value domain static evaluation works in. `UNKNOWN` is a plan-time
 * unknown: anything a provider computes. It propagates through operators and
 * functions; everything declared in configuration and tfvars is concrete.
 */

export const UNKNOWN: unique symbol = Symbol('unknown');
export type Unknown = typeof UNKNOWN;
export type Value =
  | string
  | number
  | boolean
  | null
  | Unknown
  | readonly Value[]
  | { readonly [key: string]: Value };

export class EvalError extends Error {}

export function isUnknown(value: Value): value is Unknown {
  return value === UNKNOWN;
}

export function isObject(
  value: Value
): value is { readonly [key: string]: Value } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isList(value: Value): value is readonly Value[] {
  return Array.isArray(value);
}

/** Define `key` on `target` as a memoised getter; re-entry yields UNKNOWN. */
export function defineLazy(
  target: Record<string, Value>,
  key: string,
  compute: () => Value
): void {
  let state: 'idle' | 'running' | 'done' = 'idle';
  let cached: Value = UNKNOWN;
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: () => {
      if (state === 'done') return cached;
      if (state === 'running') return UNKNOWN;
      state = 'running';
      try {
        cached = compute();
      } catch (error) {
        if (!(error instanceof EvalError || error instanceof TypeError)) {
          throw error;
        }
        cached = UNKNOWN;
      }
      state = 'done';
      return cached;
    },
  });
}

export function stringify(value: Value): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new EvalError('cannot convert a collection to a string');
}

export function truthy(value: Value): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
}

/** Object keys in the order OpenTofu iterates them (lexicographic). */
export function sortedKeys(value: { readonly [key: string]: Value }): string[] {
  return Object.keys(value).sort();
}

/** True when `value` or anything inside it is unknown. */
export function containsUnknown(value: Value): boolean {
  if (isUnknown(value)) return true;
  if (isList(value)) return value.some(containsUnknown);
  if (isObject(value)) {
    return Object.values(value as Record<string, Value>).some(containsUnknown);
  }
  return false;
}

/** Code-unit comparison: the order OpenTofu sorts strings in. */
export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
