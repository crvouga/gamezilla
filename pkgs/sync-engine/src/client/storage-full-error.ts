/** Thrown when local SQLite rejects a write (quota / SQLITE_FULL). */
export class SqliteStorageFullError extends Error {
  override readonly name = 'SqliteStorageFullError';
  constructor(message = 'SQLITE_FULL') {
    super(message);
  }
}

export function isStorageFullError(error: unknown): boolean {
  if (error instanceof SqliteStorageFullError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /SQLITE_FULL|database or disk is full|quota exceeded/i.test(msg);
}
