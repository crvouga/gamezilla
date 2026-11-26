import { expect, spyOn, test } from 'bun:test';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { migrateLocalSchema } from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';

// regression: sync-warm-boot-redundant-ddl
test.each([false, true])(
  'warm boot issues DDL only for existing retired tables (legacy=%s)',
  async (legacy) => {
    const db = SqlClientImplBunSqlite.openMemory();
    try {
      await migrateLocalSchema(db, exampleLocalSchema);
      if (legacy) await db.run(sql`CREATE TABLE _scope_meta (id TEXT)`);
      const writes = spyOn(db, 'run');
      await migrateLocalSchema(db, exampleLocalSchema);
      const ddl = writes.mock.calls
        .map(([q]) => q.sql.trim())
        .filter((s) => /^(DROP|CREATE|ALTER|PRAGMA user_version\s*=)/i.test(s));
      expect(ddl).toHaveLength(legacy ? 1 : 0);
      expect(
        await db.query(
          sql<{
            name: string;
          }>`SELECT name FROM sqlite_master WHERE name = '_scope_meta'`
        )
      ).toEqual([]);
    } finally {
      await db.disconnect();
    }
  }
);
