function flattenErrorMessage(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      current = 'cause' in current ? current.cause : undefined;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' → ').toLowerCase();
}

/** Message-only matcher for OPFS / worker failures recoverable by wiping local SQLite. */
export function matchesRecoverableExpoSqliteWebErrorMessage(
  error: unknown
): boolean {
  const msg = flattenErrorMessage(error);
  return (
    msg.includes('cannot create file') ||
    msg.includes('sqlite3_open_v2') ||
    msg.includes('error finalizing statement') ||
    msg.includes('database disk image is malformed') ||
    msg.includes('file is not a database') ||
    msg.includes('database corruption') ||
    msg.includes('sqlite_ioerr') ||
    msg.includes('automatic recovery is blocked') ||
    msg.includes('holding the opfs handle')
  );
}

export const EXPO_SQLITE_WEB_FATAL_EVENT = 'gamezilla:expo-sqlite-fatal';
