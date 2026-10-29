import { describe, expect, test } from 'bun:test';
import { runSqlCell } from '@pkgs/harness-console-client-ts/run-sql-cell';
import { executeSqlStatements } from '@pkgs/sql-client-root-shared-ts/statements';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { raw, sql } from '@pkgs/sql-root-shared-ts/sql';

describe('runSqlCell', () => {
  test('select and dml in one cell transaction', async () => {
    const client = SqlClientImplMockingbirdSqlite.open();
    await client.connect();
    await client.run(raw('CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER)'));
    const now = (() => {
      let t = 0;
      return () => {
        t += 5;
        return t;
      };
    })();
    const ok = await runSqlCell({
      execute: (statements) => executeSqlStatements(client, statements),
      sql: `INSERT INTO t (id, n) VALUES (1, 10);\nSELECT n FROM t;`,
      now,
    });
    expect(ok.error).toBeNull();
    expect(ok.statements).toHaveLength(2);
    expect(ok.statements[0]).toMatchObject({ kind: 'changes', changes: 1 });
    expect(ok.statements[1]).toMatchObject({
      kind: 'rows',
      rows: [{ n: 10 }],
    });
    expect(ok.durationMs).toBeGreaterThan(0);

    const fail = await runSqlCell({
      execute: (statements) => executeSqlStatements(client, statements),
      sql: `INSERT INTO t (id, n) VALUES (2, 20);\nINSERT INTO t (id, n) VALUES (1, 99);`,
      now,
    });
    expect(fail.error).not.toBeNull();
    const rows = await client.query<{ c: number }>(
      raw('SELECT COUNT(*) AS c FROM t')
    );
    expect(Number(rows[0]?.c)).toBe(1);
    await client.disconnect();
  });
  test('a commented saved question runs and still shows its answer', async () => {
    // regression: notebook-commented-question
    const client = SqlClientImplMockingbirdSqlite.open();
    await client.connect();
    await client.run(raw('CREATE TABLE t (id INTEGER PRIMARY KEY, n TEXT)'));
    await client.run(sql`INSERT INTO t (id, n) VALUES (1, ${'a--b; /* c */'})`);
    const run = (sql: string) =>
      runSqlCell({
        execute: (statements) => executeSqlStatements(client, statements),
        sql,
        now: () => 0,
      });

    const line = await run('-- saved question\nSELECT 1 AS one');
    expect(line.error).toBeNull();
    expect(line.statements).toMatchObject([
      { kind: 'rows', rows: [{ one: 1 }] },
    ]);

    const block = await run('/* saved question */ SELECT 1 AS one');
    expect(block.error).toBeNull();
    expect(block.statements).toMatchObject([
      { kind: 'rows', rows: [{ one: 1 }] },
    ]);

    const literal = await run("SELECT n FROM t WHERE n = 'a--b; /* c */'");
    expect(literal.error).toBeNull();
    expect(literal.statements).toMatchObject([
      { kind: 'rows', rows: [{ n: 'a--b; /* c */' }] },
    ]);
    await client.disconnect();
  });
});
