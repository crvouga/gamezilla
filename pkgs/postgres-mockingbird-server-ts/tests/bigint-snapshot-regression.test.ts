import { expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server-ts/start';
import { SQL } from 'bun';

// regression: mockingbird-postgres-snapshot-bigint
test('reopening retained Postgres data preserves bigint increments', async () => {
  const store = new ObjectStoreImplInMemory();
  const original = await startMockingbirdPostgres({ port: 0, store });
  const first = new SQL({ url: original.url, max: 1 });
  try {
    await first.unsafe(
      'CREATE TABLE counter (id text PRIMARY KEY, revision bigint NOT NULL)'
    );
    await first.unsafe("INSERT INTO counter VALUES ('default', 1)");
    expect(
      await first.unsafe(
        'UPDATE counter SET revision = revision + 1 RETURNING revision::integer AS revision'
      )
    ).toEqual([{ revision: 2 }]);
  } finally {
    await first.close();
    await original.stop();
  }
  const restored = await startMockingbirdPostgres({ port: 0, store });
  const second = new SQL({ url: restored.url, max: 1 });
  try {
    expect(
      await second.unsafe(
        'UPDATE counter SET revision = revision + 1 RETURNING revision::integer AS revision'
      )
    ).toEqual([{ revision: 3 }]);
  } finally {
    await second.close();
    await restored.stop();
  }
});
