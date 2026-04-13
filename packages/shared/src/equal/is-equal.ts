/**
 * Deep structural equality.
 *
 * - Primitives: {@link Object.is} (so `NaN` equals `NaN`, and `+0` ≠ `-0`)
 * - `null` and `undefined` only match themselves
 * - Arrays: same length, each index compared in order
 * - Plain objects: same own string keys, values compared (order of keys does not matter)
 * - `Date`: same timestamp
 * - `RegExp`: same `source` and `flags`
 * - `Map` / `Set`: compared structurally (Map keys use `SameValueZero` like the built-in)
 *
 * Circular references are handled: comparing the same object pair while already
 * visiting that pair completes successfully when the surrounding structure matches.
 */

export function isEqual(a: unknown, b: unknown): boolean {
  return deepEqual(a, b, []);
}

function deepEqual(
  a: unknown,
  b: unknown,
  stack: Array<[object, object]>
): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  if (stack.some(([x, y]) => x === a && y === b)) return true;

  const ao = a as object;
  const bo = b as object;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    stack.push([ao, bo]);
    try {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i], stack)) return false;
      }
      return true;
    } finally {
      stack.pop();
    }
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    stack.push([ao, bo]);
    try {
      for (const [k, va] of a) {
        if (!b.has(k)) return false;
        if (!deepEqual(va, b.get(k), stack)) return false;
      }
      return true;
    } finally {
      stack.pop();
    }
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    stack.push([ao, bo]);
    try {
      const matched = new Set<unknown>();
      outer: for (const va of a) {
        for (const vb of b) {
          if (matched.has(vb)) continue;
          if (deepEqual(va, vb, stack)) {
            matched.add(vb);
            continue outer;
          }
        }
        return false;
      }
      return true;
    } finally {
      stack.pop();
    }
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    return false;
  }

  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  const keysA = Object.keys(recA);
  const keysB = Object.keys(recB);
  if (keysA.length !== keysB.length) return false;
  const keySetB = new Set(keysB);
  for (const k of keysA) {
    if (!keySetB.has(k)) return false;
  }

  stack.push([ao, bo]);
  try {
    for (const k of keysA) {
      if (!deepEqual(recA[k], recB[k], stack)) return false;
    }
    return true;
  } finally {
    stack.pop();
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== 'object') return false;
  if (Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}
