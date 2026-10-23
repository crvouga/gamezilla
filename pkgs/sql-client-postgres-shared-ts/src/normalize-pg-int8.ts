/**
 * mockingbird-postgres (and node-pg) return int8 as bigint. Product paths (JSON, Math.*)
 * expect number when the value fits, else a decimal string.
 *
 * Convert via decimal text. `Number(bigint)` / unary `+bigint` throw
 * `Cannot convert BigInt to number` (ToNumber) — the web engine hits that on
 * every hydrate query that selects a Postgres bigint column.
 */
export function bigintToJsonSafe(value: bigint): number | string {
  const text = value.toString();
  const asNumber = +text;
  if (Number.isSafeInteger(asNumber) && String(asNumber) === text) {
    return asNumber;
  }
  return text;
}

export function normalizePgInt8Value(value: unknown): unknown {
  if (typeof value === 'bigint') return bigintToJsonSafe(value);
  if (Array.isArray(value)) return value.map(normalizePgInt8Value);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = normalizePgInt8Value(nested);
  }
  return out;
}

export function normalizePgInt8Rows<T extends Record<string, unknown>>(
  rows: readonly T[]
): T[] {
  return rows.map((row) => normalizePgInt8Value(row) as T);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
