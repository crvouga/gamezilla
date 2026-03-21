import { assert } from '../assert';

/**
 * Asserts that the provided SQL query string begins with a recognized SQLite statement.
 * This check is comprehensive for common DDL, DML, and transaction keywords, and includes
 * compound keywords to support most valid top-level query/statement types in SQLite.
 */
export function assertSqliteQuery(query: string): asserts query is string {
  const trimmed = query.trimStart().toUpperCase();

  const allowedPrefixes = [
    'SELECT ',
    'INSERT ',
    'UPDATE ',
    'DELETE ',
    'WITH ',
    'CREATE ',
    'ALTER ',
    'DROP ',
    'BEGIN ',
    'COMMIT',
    'ROLLBACK',
    'REPLACE ',
    'VACUUM',
    'PRAGMA ',
    'EXPLAIN ',
    'ATTACH ',
    'DETACH ',
    'ANALYZE ',
    'SAVEPOINT ',
    'RELEASE ',
  ];

  const matches = allowedPrefixes.some((prefix) => trimmed.startsWith(prefix));

  assert(matches, 'Invalid SQLite query', { query: trimmed.slice(0, 50) });
}
