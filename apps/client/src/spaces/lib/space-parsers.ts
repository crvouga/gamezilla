/**
 * Returns the trimmed string value for a stored attribute, or `null` when
 * absent / blank. The canonical "string id / string title" idiom for
 * patch-db reads.
 */
export function parseStringAttr(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * Returns `true` when the attribute has not been set (i.e. the row's
 * "*-At" timestamp is missing). Use for "is live" / "is active" checks
 * that gate on the absence of `endedAt` / `leftAt` style flags.
 */
export function parseAbsent(raw: unknown): boolean {
  return raw === undefined || raw === null;
}

/**
 * Inverse of {@link parseAbsent} — returns `true` when a stored timestamp
 * exists. Read as "has been ended" / "has left".
 */
export function parseExists(raw: unknown): boolean {
  return raw !== undefined && raw !== null;
}

/** Parses a stored role string to a typed `'host' | 'guest'`. */
export function parseRole(raw: unknown): 'host' | 'guest' | null {
  if (raw === 'host') return 'host';
  if (raw === 'guest') return 'guest';
  return null;
}
