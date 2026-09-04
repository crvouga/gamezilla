import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { emitSqliteCreateStatements } from '@pkgs/db-schema/sqlite';
import { bunSqliteDumpToSqlm } from '@pkgs/sim-console/server/bun-sqlite-dump-to-sqlm';
import { raw } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

const tSchema = registerTables([
  defineTable({
    domain: 't',
    name: 't',
    columns: { name: 'text' },
  }),
]);

describe('bunSqliteDumpToSqlm', () => {
  test('copies tables and user_version into SQLM', async () => {
    const src = new Database(':memory:');
    for (const ddl of emitSqliteCreateStatements(tSchema)) {
      src.run(ddl);
    }
    src.run("INSERT INTO t (id, name) VALUES ('1', 'a')");
    src.run('PRAGMA user_version = 3');
    const bytes = new Uint8Array(src.serialize());
    src.close();

    const sqlm = await bunSqliteDumpToSqlm(bytes, 1_700_000_000_000);
    const mem = SqlClientImplSqliteMem.open({ now: () => new Date(0) });
    await mem.connect();
    try {
      mem.importDatabaseBytes(sqlm);
      const rows = await mem.query<{ id: string; name: string }>(
        raw('SELECT id, name FROM t')
      );
      const ver = await mem.query<{ user_version: number }>(
        raw('PRAGMA user_version')
      );
      expect(rows).toEqual([{ id: '1', name: 'a' }]);
      expect(ver[0]?.user_version).toBe(3);
    } finally {
      await mem.disconnect();
    }
  });
});
