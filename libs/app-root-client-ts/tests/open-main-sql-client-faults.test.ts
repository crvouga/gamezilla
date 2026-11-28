import { expect, test } from 'bun:test';
import { openMainSqlClient } from '@libs/app-env-client-ts/open-main-sql-client';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

function healthy() {
  return SqlClientImplMockingbirdSqlite.open();
}

async function open(createClient: Parameters<typeof openMainSqlClient>[3]) {
  return openMainSqlClient(
    'alice',
    createHarnessClock().timers,
    createNoopLogger(),
    createClient
  );
}

// regression: sqlite-boot-discards-durable-storage
test('an unavailable durable database is reported instead of replaced with empty memory', async () => {
  await expect(
    open(() => {
      throw new Error('durable store unavailable');
    })
  ).rejects.toThrow('durable store unavailable');
});

// regression: opfs-wipe-channel-renamed-across-versions
test('the local database listens for recovery on the same channel in every version', async () => {
  // A tab still running an older version only hears a recovery request sent
  // on the channel it listens to: `<namespace>-opfs-wipe`, from the immutable
  // technical namespace, never a name that changes with the code or the brand.
  let wipeChannel: string | undefined;
  const client = await open((_dbName, options) => {
    wipeChannel = options.wipeChannel;
    return healthy();
  });
  await client.disconnect();
  expect(wipeChannel).toBe(`${NAMESPACE}-opfs-wipe`);
});

// regression: sqlite-boot-discards-durable-storage
test('an open taking eight seconds still returns the saved database', async () => {
  const clock = createHarnessClock();
  const connection = Promise.withResolvers<void>();
  const db = healthy();
  await db.connect();
  await db.run(sql`CREATE TABLE saved_boot_probe (value TEXT)`);
  await db.run(sql`INSERT INTO saved_boot_probe VALUES (${'saved'})`);
  const delayed = new Proxy(db, {
    get(target, property) {
      if (property === 'connect') return () => connection.promise;
      return Reflect.get(target, property, target);
    },
  });
  const pending = openMainSqlClient(
    'alice',
    clock.timers,
    createNoopLogger(),
    () => delayed
  );
  clock.clock.advance(8_000);
  connection.resolve();
  const client = await pending;
  try {
    expect(client).toBe(delayed);
    expect(
      await client.query(
        sql<{ value: string }>`SELECT value FROM saved_boot_probe`
      )
    ).toEqual([{ value: 'saved' }]);
  } finally {
    await client.disconnect();
  }
});
