import { describe, expect, test } from 'bun:test';

import { splitSqlStatements } from './apply-framework-server-ddl';

describe('splitSqlStatements', () => {
  test('does not split on semicolons inside line comments', () => {
    const sql = `-- deploy; statements here
CREATE TABLE IF NOT EXISTS t (id TEXT);`;
    const statements = splitSqlStatements(sql);
    expect(statements).toEqual(['CREATE TABLE IF NOT EXISTS t (id TEXT)']);
  });

  test('preserves dollar-quoted blocks', () => {
    const sql = `DO $$
BEGIN
  NULL;
END
$$;`;
    expect(splitSqlStatements(sql)).toEqual([sql.replace(/;\s*$/, '')]);
  });
});
