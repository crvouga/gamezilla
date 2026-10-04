import { describe, expect, test } from 'bun:test';

import {
  classifySqlStatement,
  splitSqlStatements,
  tokenizeSql,
} from '@pkgs/harness-console-client/sql-tokenize';

describe('tokenizeSql', () => {
  test('keywords strings comments numbers', () => {
    const src = `-- hi\nSELECT 'a''b', 42 FROM t /* x */ WHERE id = $1;`;
    const tokens = tokenizeSql(src, 'postgres');
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toContain('comment');
    expect(kinds).toContain('keyword');
    expect(kinds).toContain('string');
    expect(kinds).toContain('number');
    expect(kinds).toContain('param');
    const words = tokens
      .filter((t) => t.kind === 'keyword')
      .map((t) => src.slice(t.start, t.end).toLowerCase());
    expect(words).toContain('select');
    expect(words).toContain('from');
    expect(words).toContain('where');
  });

  test('sqlite pragma keyword', () => {
    const src = 'PRAGMA table_info(users)';
    const tokens = tokenizeSql(src, 'sqlite');
    const first = tokens[0]!;
    expect(first.kind).toBe('keyword');
    expect(src.slice(first.start, first.end).toLowerCase()).toBe('pragma');
  });
});

describe('splitSqlStatements', () => {
  test('splits on bare semicolons', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual([
      'SELECT 1',
      'SELECT 2',
    ]);
  });

  test('ignores semicolons in strings and comments', () => {
    const src = `SELECT ';'; -- ;\nSELECT /* ; */ 2`;
    expect(splitSqlStatements(src)).toEqual([
      `SELECT ';'`,
      '-- ;\nSELECT /* ; */ 2',
    ]);
  });

  test('trims empties', () => {
    expect(splitSqlStatements('  ;  SELECT 1;  ;')).toEqual(['SELECT 1']);
  });
});

describe('classifySqlStatement', () => {
  test('rows vs changes', () => {
    expect(classifySqlStatement('SELECT 1')).toBe('rows');
    expect(classifySqlStatement('WITH x AS (SELECT 1) SELECT * FROM x')).toBe(
      'rows'
    );
    expect(classifySqlStatement('PRAGMA table_info(t)')).toBe('rows');
    expect(classifySqlStatement('INSERT INTO t VALUES (1)')).toBe('changes');
    expect(classifySqlStatement('-- c\nUPDATE t SET a=1')).toBe('changes');
  });
});
