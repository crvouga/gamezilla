/**
 * Structural equality for plain JSON-like data (primitives, arrays, records).
 *
 * Conservative by design: anything that is not obviously equal (NaN, class
 * instances with hidden state, `undefined`-valued own properties on one side
 * only) reports `false`. Callers use `false` as "do the slow, always-correct
 * thing", so a false negative only costs time, never correctness.
 */
export function plainDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) return arraysEqual(a, b as readonly unknown[]);
  return recordsEqual(
    a as Record<string, unknown>,
    b as Record<string, unknown>
  );
}

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  const n = a.length;
  if (n !== b.length) return false;
  for (let i = 0; i < n; i++) {
    if (!plainDeepEqual(a[i], b[i])) return false;
  }
  return true;
}

function recordsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!plainDeepEqual(a[key], b[key])) return false;
  }
  return true;
}
