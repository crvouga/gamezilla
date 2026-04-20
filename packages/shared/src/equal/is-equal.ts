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
 * Circular references are handled: if the same object pair is encountered again
 * while it is already in-flight, it is treated as equal (the surrounding
 * comparison still determines the overall result).
 *
 * Implemented iteratively with an explicit work stack to avoid recursion
 * overhead and stack-overflow risk on deep structures.
 */

export function isEqual(a: unknown, b: unknown): boolean {
  const work: unknown[] = [a, b];
  const seen = new Map<object, WeakSet<object>>();

  while (work.length > 0) {
    const y = work.pop();
    const x = work.pop();
    if (Object.is(x, y)) continue;
    if (!isNonNullObject(x) || !isNonNullObject(y)) return false;
    if (!markSeen(x, y, seen)) continue;
    if (!compareObjectPair(x, y, work)) return false;
  }

  return true;
}

function isNonNullObject(x: unknown): x is object {
  return typeof x === 'object' && x !== null;
}

/**
 * Record that we're comparing `x` against `y`. Returns `false` when we have
 * already started (or finished) comparing this exact pair, letting the caller
 * short-circuit to equal — this is what makes cycles terminate.
 */
function markSeen(
  x: object,
  y: object,
  seen: Map<object, WeakSet<object>>
): boolean {
  const bucket = seen.get(x);
  if (bucket !== undefined) {
    if (bucket.has(y)) return false;
    bucket.add(y);
    return true;
  }
  const bucketForX = new WeakSet<object>();
  bucketForX.add(y);
  seen.set(x, bucketForX);
  return true;
}

/**
 * Dispatch on the shape of a non-null object pair. Returns `true` when the
 * pair matches at this level (with any child pairs appended to `work`), and
 * `false` when the pair is definitely unequal.
 */
function compareObjectPair(x: object, y: object, work: unknown[]): boolean {
  const xIsArray = Array.isArray(x);
  const yIsArray = Array.isArray(y);
  if (xIsArray !== yIsArray) return false;
  if (xIsArray) return compareArrays(x as unknown[], y as unknown[], work);

  if (x instanceof Date || y instanceof Date) {
    return x instanceof Date && y instanceof Date && compareDates(x, y);
  }

  if (x instanceof RegExp || y instanceof RegExp) {
    return x instanceof RegExp && y instanceof RegExp && compareRegExps(x, y);
  }

  if (x instanceof Map || y instanceof Map) {
    return x instanceof Map && y instanceof Map && compareMaps(x, y, work);
  }

  if (x instanceof Set || y instanceof Set) {
    return x instanceof Set && y instanceof Set && compareSets(x, y);
  }

  if (!isPlainObject(x) || !isPlainObject(y)) return false;
  return comparePlainObjects(x, y, work);
}

function compareArrays(x: unknown[], y: unknown[], work: unknown[]): boolean {
  const len = x.length;
  if (len !== y.length) return false;
  for (let i = 0; i < len; i++) {
    work.push(x[i], y[i]);
  }
  return true;
}

function compareDates(x: Date, y: Date): boolean {
  return x.getTime() === y.getTime();
}

function compareRegExps(x: RegExp, y: RegExp): boolean {
  return x.source === y.source && x.flags === y.flags;
}

function compareMaps(
  x: Map<unknown, unknown>,
  y: Map<unknown, unknown>,
  work: unknown[]
): boolean {
  if (x.size !== y.size) return false;
  for (const [k, vx] of x) {
    if (!y.has(k)) return false;
    work.push(vx, y.get(k));
  }
  return true;
}

/**
 * Set matching is inherently order-insensitive with trial-and-error per
 * element; each trial uses its own fresh iterative `isEqual` pass so failed
 * attempts do not pollute the outer seen map or work stack.
 */
function compareSets(x: Set<unknown>, y: Set<unknown>): boolean {
  if (x.size !== y.size) return false;
  const matched = new Set<unknown>();
  outer: for (const vx of x) {
    for (const vy of y) {
      if (matched.has(vy)) continue;
      if (isEqual(vx, vy)) {
        matched.add(vy);
        continue outer;
      }
    }
    return false;
  }
  return true;
}

function comparePlainObjects(
  x: Record<string, unknown>,
  y: Record<string, unknown>,
  work: unknown[]
): boolean {
  const keysX = Object.keys(x);
  const keysY = Object.keys(y);
  if (keysX.length !== keysY.length) return false;
  const keySetY = new Set(keysY);
  for (let i = 0; i < keysX.length; i++) {
    if (!keySetY.has(keysX[i]!)) return false;
  }
  for (let i = 0; i < keysX.length; i++) {
    const k = keysX[i]!;
    work.push(x[k], y[k]);
  }
  return true;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== 'object') return false;
  if (Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}
