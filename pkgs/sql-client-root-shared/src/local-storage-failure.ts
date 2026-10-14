/**
 * Tells "this SQL statement is wrong or refused by a data rule" from "the
 * storage under the database is unusable". A local cache survives the first
 * by reporting it to the caller and survives the second by being replaced.
 *
 * - `statement`: the database answered. Reporting it to the caller is right
 *   (a constraint, a syntax error, a missing table).
 * - `storage`: the database file or the worker that hosts it is damaged,
 *   full, read-only, locked or gone.
 * - `unknown`: neither wording matched; the caller probes the database.
 */

export type LocalStorageFailureKind = 'statement' | 'storage' | 'unknown';

/** SQLite result codes and messages that mean the storage itself is bad. */
const STORAGE_FAILURE =
  /SQLITE_(?:CORRUPT|NOTADB|IOERR|FULL|CANTOPEN|READONLY|NOMEM|PROTOCOL|BUSY|LOCKED|INTERNAL|NOLFS|EMPTY|FORMAT)|disk image is malformed|file is not a database|disk I\/O error|database or disk is full|unable to open database|readonly database|database is locked|database is closed|NoModificationAllowedError|NotReadableError|QuotaExceededError|E_LEADER_LOST|LeaderLostError|E_NOT_CONNECTED|E_TIMEOUT|E_TX_TIMEOUT|E_TX_ABORTED|RpcTimeoutError|did not become ready/iu;

/** The database answered; the statement or the data was refused. */
const STATEMENT_FAILURE =
  /SQLITE_(?:CONSTRAINT|ERROR|MISMATCH|RANGE|MISUSE|AUTH|TOOBIG)|constraint failed|syntax error|no such (?:table|column|function|index|savepoint)|datatype mismatch|no tables specified|incomplete input|already exists|has no column named|too many SQL variables/iu;

function describe(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return `${error.name} ${typeof code === 'string' ? code : ''} ${error.message}`;
  }
  return String(error);
}

export function classifyLocalStorageFailure(
  error: unknown
): LocalStorageFailureKind {
  const text = describe(error);
  if (STORAGE_FAILURE.test(text)) return 'storage';
  if (STATEMENT_FAILURE.test(text)) return 'statement';
  return 'unknown';
}
