function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  return null;
}

function readWebUserAgent(): string | null {
  if (typeof globalThis === 'undefined') return null;
  if (!('navigator' in globalThis) || globalThis.navigator === undefined) {
    return null;
  }
  if (typeof globalThis.navigator.userAgent !== 'string') return null;
  return normString(globalThis.navigator.userAgent);
}

function put(
  attrs: Record<string, string>,
  key: string,
  value: string | null
): void {
  if (value !== null) attrs[key] = value;
}

/**
 * Best-effort device metadata for the current install, keyed by snake_case
 * column names matching `devices`. Sent to `POST /identity/refresh`, which merges
 * the record into the server row without field-name remapping.
 */
export function collectDeviceSnapshot(): Record<string, string> {
  const attrs: Record<string, string> = {};
  put(attrs, 'platform', 'web');
  put(attrs, 'user_agent', readWebUserAgent());
  return attrs;
}
