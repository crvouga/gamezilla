import { defineTable, registerTables } from '@pkgs/db-schema';
import { emitSqliteCreateStatements } from '@pkgs/db-schema/sqlite';

export const kvDdl = emitSqliteCreateStatements(
  registerTables([
    defineTable({
      domain: 'kv',
      name: 'kv',
      columns: { k: 'text', v: 'text' },
      uniqueIndexes: ['k'],
    }),
  ])
);
