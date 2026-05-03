import { afterEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { createLogger } from '../logger';
import { SqlClientImplPglite } from '../sql-client/impl-pglite';
import {
  EntityDbImplPostgres,
  migrateDownEntityDbPostgres,
  migrateEntityDbPostgres,
} from './impl-postgres';

/** Matches `listDefaultPartitionBaseName` in impl-postgres.ts */
function defaultPartitionName(tableBase: string): string {
  return `${tableBase}_default`;
}

describe('EntityDbImplPostgres migrateDown', () => {
  let pglite: PGlite | null = null;

  afterEach(async () => {
    if (pglite !== null) {
      await pglite.close();
      pglite = null;
    }
  });

  test('migrate then migrateDown removes parent, partition, indexes; second down is no-op', async () => {
    pglite = await PGlite.create();
    const sqlClient = new SqlClientImplPglite(pglite);
    const log = createLogger({ name: 'entity-db:migrate-down-test' });

    await migrateEntityDbPostgres({ sqlClient, logger: log });

    const schemaName = 'public';
    const tableBase = 'entities';

    const tablesAfterUp = await sqlClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = ? AND tablename IN (?, ?) ORDER BY tablename`,
      [schemaName, tableBase, defaultPartitionName(tableBase)]
    );
    expect(tablesAfterUp.map((r) => r.tablename).sort()).toEqual([
      tableBase,
      defaultPartitionName(tableBase),
    ]);

    const idxAfterUp = await sqlClient.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = ? AND tablename = ? ORDER BY indexname`,
      [schemaName, tableBase]
    );
    expect(idxAfterUp.length).toBe(6);

    await migrateDownEntityDbPostgres({ sqlClient, logger: log });

    const tablesAfterDown = await sqlClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = ? AND tablename IN (?, ?)`,
      [schemaName, tableBase, defaultPartitionName(tableBase)]
    );
    expect(tablesAfterDown.length).toBe(0);

    const idxAfterDown = await sqlClient.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = ? AND tablename = ?`,
      [schemaName, tableBase]
    );
    expect(idxAfterDown.length).toBe(0);

    await expect(
      migrateDownEntityDbPostgres({ sqlClient, logger: log })
    ).resolves.toBeUndefined();

    await expect(
      EntityDbImplPostgres.migrateDown({ sqlClient, logger: log })
    ).resolves.toBeUndefined();
  });
});
