/**
 * Errors for tests that make a local database fail the way a browser's does:
 * the wording its SQLite stack, its file system and its worker really use.
 */

/** Errors a browser SQLite stack raises when its storage is unusable. */
export const STORAGE_FAULTS = {
  corrupt: () =>
    Object.assign(
      new Error(
        'SQLITE_CORRUPT: sqlite3 result code 11: database disk image is malformed'
      ),
      { name: 'SQLite3Error' }
    ),
  notADatabase: () =>
    new Error('SQLITE_NOTADB: sqlite3 result code 26: file is not a database'),
  io: () =>
    new Error('SQLITE_IOERR_WRITE: sqlite3 result code 778: disk I/O error'),
  full: () =>
    new Error('SQLITE_FULL: sqlite3 result code 13: database or disk is full'),
  readOnly: () =>
    new Error(
      'SQLITE_READONLY: sqlite3 result code 8: attempt to write a readonly database'
    ),
  cantOpen: () =>
    new Error(
      'SQLITE_CANTOPEN: sqlite3 result code 14: unable to open database file'
    ),
  quota: () =>
    Object.assign(new Error('The quota has been exceeded.'), {
      name: 'QuotaExceededError',
    }),
  lockedHandle: () =>
    Object.assign(
      new Error(
        'Access Handles cannot be created if there is another open Access Handle'
      ),
      { name: 'NoModificationAllowedError' }
    ),
  leaderLost: () =>
    Object.assign(new Error('Database owner lost'), {
      name: 'LeaderLostError',
      code: 'E_LEADER_LOST',
    }),
  /** Worded like nothing the classifier knows: only the probe can tell. */
  unrecognised: () => new Error('worker exploded in an unforeseen way'),
} as const;

export type StorageFaultName = keyof typeof STORAGE_FAULTS;

/** What the database answers when a statement is wrong or refused. */
export const STATEMENT_ERRORS = {
  unique: 'SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: kv.k',
  noTable: 'SQLITE_ERROR: sqlite3 result code 1: no such table: missing',
  syntax: 'SQLITE_ERROR: sqlite3 result code 1: near "SELEC": syntax error',
} as const;
