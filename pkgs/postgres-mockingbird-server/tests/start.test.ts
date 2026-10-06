import { expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import { SQL } from 'bun';

// regression: native-postgres-missing-icu
// This starts the public service and queries it through the production driver.
test('starts an isolated Postgres wire server without native binaries', async () => {
  const a = await startMockingbirdPostgres({
    port: 0,
    store: new ObjectStoreImplInMemory(),
  });
  const b = await startMockingbirdPostgres({
    port: 0,
    store: new ObjectStoreImplInMemory(),
  });
  try {
    expect(a.port).not.toBe(b.port);
    const sqlClient = new SQL({ url: a.url, max: 1 });
    try {
      expect(
        await sqlClient.unsafe<{ answer: number }[]>(
          'SELECT 42::int4 AS answer'
        )
      ).toEqual([{ answer: 42 }]);
    } finally {
      await sqlClient.close();
    }
  } finally {
    await Promise.all([a.stop(), b.stop()]);
  }
});

test('restores committed state on the next start and discards open transactions', async () => {
  const store = new ObjectStoreImplInMemory();
  const first = await startMockingbirdPostgres({ port: 0, store });
  const sqlClient = new SQL({ url: first.url, max: 1 });
  await sqlClient.unsafe('CREATE SCHEMA saved');
  await sqlClient.unsafe('BEGIN');
  await sqlClient.unsafe('CREATE SCHEMA abandoned');
  await first.stop();
  await sqlClient.close();
  const second = await startMockingbirdPostgres({ port: 0, store });
  try {
    const reopened = new SQL({ url: second.url, max: 1 });
    try {
      const rows = await reopened.unsafe<{ schema_name: string }[]>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('saved', 'abandoned') ORDER BY schema_name`
      );
      expect(rows).toEqual([{ schema_name: 'saved' }]);
    } finally {
      await reopened.close();
    }
  } finally {
    await second.stop();
  }
});
