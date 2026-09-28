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
  if (
    /SQLITE_FULL|database or disk is full|quota exceeded|harness: torn transaction|harness: storage quota/i.test(
      msg
    )
  ) {
    return true;
  }
  if (error instanceof Error && error.cause !== undefined) {
    return isStorageFullError(error.cause);
  }
  return false;
}
