import { isPlainRecord } from './plain-record';

function stableStringifyScalar(value: unknown, t: string): string {
  if (t === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('stableStringify: non-finite number');
    }
    return JSON.stringify(value);
  }
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'bigint') throw new Error('stableStringify: bigint not supported');
  throw new Error(`stableStringify: unsupported type ${t}`);
}

/**
 * Deterministic JSON serialization for hashing and signatures.
 * Sorts object keys recursively; preserves array order.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t !== 'object') return stableStringifyScalar(value, t);
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(',')}]`;
  }
  if (!isPlainRecord(value)) {
    throw new Error('stableStringify: expected plain object');
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}
