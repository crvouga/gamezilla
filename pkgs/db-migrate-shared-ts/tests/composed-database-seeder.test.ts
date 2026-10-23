import { describe, expect, test } from 'bun:test';
import { ComposedDatabaseSeeder } from '@pkgs/db-migrate-shared-ts/composed-database-seeder';
import type {
  DatabaseSeeder,
  DatabaseSeederContext,
} from '@pkgs/db-migrate-shared-ts/database-seeder';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

function fakeCtx(): DatabaseSeederContext {
  return {
    sqlClient: {} as SqlClient,
    logger: { child: () => ({}) } as unknown as Logger,
  };
}

describe('ComposedDatabaseSeeder', () => {
  test('runs registered seeders in registration order', async () => {
    const order: string[] = [];
    const make = (id: string): DatabaseSeeder => ({
      async seed() {
        order.push(id);
      },
    });

    const composed = new ComposedDatabaseSeeder()
      .register(make('a'))
      .register(make('b'))
      .register(make('c'));

    await composed.seed(fakeCtx());
    expect(order).toEqual(['a', 'b', 'c']);
  });

  test('no-ops when nothing is registered', async () => {
    await new ComposedDatabaseSeeder().seed(fakeCtx());
  });
});
