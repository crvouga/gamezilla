import { describe, expect, test } from 'bun:test';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { ComposedDatabaseMigration } from './composed-database-migration';
import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from './database-migration';

function fakeCtx(): DatabaseMigrationContext {
  return {
    sqlClient: {} as SqlClient,
    logger: { child: () => ({}) } as unknown as Logger,
  };
}

describe('ComposedDatabaseMigration', () => {
  test('runs registered migrations in registration order', async () => {
    const order: string[] = [];
    const make = (id: string): DatabaseMigration => ({
      async migrate() {
        order.push(id);
      },
    });

    const composed = new ComposedDatabaseMigration()
      .register(make('a'))
      .register(make('b'))
      .register(make('c'));

    await composed.migrate(fakeCtx());
    expect(order).toEqual(['a', 'b', 'c']);
  });

  test('no-ops when nothing is registered', async () => {
    await new ComposedDatabaseMigration().migrate(fakeCtx());
  });
});
