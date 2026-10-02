import { expect, test } from 'bun:test';
import { APP_QUERIES } from '@libs/runtime/root/app-queries';
import { appSchema } from '@libs/runtime/root/app-schema';
import { runMigrateIndexReconcile } from '@libs/runtime/server/run-migrate-index-reconcile';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes';
import { createHarnessClock, HarnessDb } from '@pkgs/db-indexes/harness';
import { MANAGED_IMPLICIT_COLUMN_NAMES } from '@pkgs/db-schema';
import { createLogger } from '@pkgs/logger';
import { extractWorkload } from '@pkgs/sync-engine/shared';

// regression: index-join-column-wrong-table
test('fresh database workload reconciliation uses only declared columns', async () => {
  const schema = appSchema.snapshot();
  const clock = createHarnessClock(0);
  const db = new HarnessDb({
    clock,
    tables: Object.keys(schema.tables).map((name) => ({
      name,
      estimatedRows: 0,
    })),
  });
  db.parseStatement = (sql) => parseWithNodeSqlParser(sql, 'PostgreSQL');
  const execute = db.execute.bind(db);
  db.execute = async (action, deadline) => {
    if (action.kind === 'create' && action.definition !== null) {
      const definition = action.definition;
      const columns = schema.tables[definition.table];
      expect(columns).toBeDefined();
      for (const column of [
        ...definition.columns.map((key) => key.name),
        ...definition.include,
      ]) {
        expect(
          [...MANAGED_IMPLICIT_COLUMN_NAMES, ...Object.keys(columns!)],
          `${definition.table}.${column}`
        ).toContain(column);
      }
    }
    return execute(action, deadline);
  };
  await runMigrateIndexReconcile({
    manifest: await extractWorkload(APP_QUERIES),
    db,
    clock,
    logger: createLogger({
      name: 'test:workload-indexes',
      level: 'silent',
      now: clock.now,
    }),
  });
  const indexes = await db.introspectIndexes();
  expect(indexes.length).toBeGreaterThan(0);
  expect(
    indexes.some(
      (index) =>
        index.table === 'auth_account_devices' &&
        index.columns[0] === 'device_id'
    )
  ).toBe(true);
});
