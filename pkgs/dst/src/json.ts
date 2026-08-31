export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { readonly [k: string]: JsonValue };

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function assertJsonValue(value: unknown, path = 'value'): JsonValue {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`JsonValue: non-finite number at ${path}`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) =>
      assertJsonValue(item, `${path}[${String(i)}]`)
    );
  }
  if (isPlainObject(value)) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = assertJsonValue(value[key], `${path}.${key}`);
    }
    return out;
  }
  throw new Error(`JsonValue: unsupported type at ${path}`);
}

/** Recursive sorted-key canonical JSON. */
export function canonicalJsonStringify(value: JsonValue): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: JsonValue): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortJson);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortJson(value[key]!);
  }
  return out;
}
