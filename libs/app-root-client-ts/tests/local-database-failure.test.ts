/**
 * The local database is a cache: whatever goes wrong with it, the engine the
 * app boots on opens and keeps working. Every test here makes the database
 * fail the way a browser's does and expects a working engine, never an error.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import type { CreateAppLocalSyncEngineArgs } from '@libs/app-root-client-ts/create-local-sync-engine';
import { createAppLocalSyncEngine } from '@libs/app-root-client-ts/create-local-sync-engine';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { STORAGE_FAULTS } from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import fc from 'fast-check';

const PROBE_TABLE = defineTable({
  domain: 'probe',
  name: 'probe_items',
  columns: { label: 'text' },
});

const app = composeSubs([
  {
    name: 'probe',
    tables: [PROBE_TABLE],
    topicMap: {},
    queries: [],
    mutations: () => Promise.resolve([]),
  },
]);

const READ_TABLES = sql<{ name: string }>`
  SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name
`;
const READ_ITEMS = sql<{ id: string; label: string }>`
  SELECT id, label FROM probe_items WHERE deleted_at IS NULL
`;

const opened: SqlClient[] = [];
const engines: SyncEngine[] = [];

afterEach(async () => {
  while (engines.length > 0) await engines.pop()?.disconnect();
  while (opened.length > 0) await opened.pop()?.disconnect();
});

async function openMockingbird(): Promise<SqlClient> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  opened.push(client);
  return client;
}

const NO_RESPONSES = (): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify({ responses: [] }), {
      headers: { 'content-type': 'application/json' },
    })
  );

type World = {
  readonly clock: ReturnType<typeof createHarnessClock>;
  readonly args: CreateAppLocalSyncEngineArgs;
};

function world(
  openSqlClient: CreateAppLocalSyncEngineArgs['openSqlClient'],
  overrides: Partial<CreateAppLocalSyncEngineArgs> = {}
): World {
  const clock = createHarnessClock();
  let ids = 0;
  return {
    clock,
    args: {
      loadApp: () => Promise.resolve(app),
      config: { getApiUrl: () => 'http://localhost' },
      fetchFn: NO_RESPONSES,
      userId: 'alice',
      databaseName: 'user_alice',
      getFreshAuthToken: () => Promise.resolve(null),
      auth: {
        getAccountId: () => 'alice',
        getDeviceId: () => 'device-1',
        getSessionToken: () => null,
      },
      clock: clock.clock,
      timers: clock.timers,
      createId: () => `id-${++ids}`,
      random: () => 0.5,
      moderation: shippedModerationRules(),
      mutationRegistry: {},
      openSqlClient,
      ...overrides,
    },
  };
}

async function boot(w: World): Promise<SyncEngine> {
  const engine = await createAppLocalSyncEngine(w.args);
  engines.push(engine);
  await engine.connect();
  return engine;
}

async function expectUsable(engine: SyncEngine): Promise<void> {
  const tables = (await engine.db.query(READ_TABLES)).map((row) => row.name);
  expect(tables).toContain('probe_items');
  expect(tables).toContain('sync_engine_mutations');
  await engine.db.run(
    sql`INSERT INTO probe_items (id, label, deleted_at) VALUES (${'new'}, ${'kept'}, NULL)`
  );
  expect(await engine.db.query(READ_ITEMS)).toEqual([
    { id: 'new', label: 'kept' },
  ]);
}

async function seedItem(client: SqlClient): Promise<void> {
  await client.run(
    sql`INSERT INTO probe_items (id, label, deleted_at) VALUES (${'old'}, ${'cached'}, NULL)`
  );
}

/** Lets queued work run until `done`, or fails the test. */
async function settles(done: () => boolean): Promise<void> {
  for (let turn = 0; turn < 200; turn += 1) {
    if (done()) return;
    await Bun.sleep(0);
  }
  expect(done()).toBe(true);
}

async function seedExtra(client: SqlClient): Promise<void> {
  await client.run(
    sql`INSERT INTO probe_items (id, label, deleted_at) VALUES (${'more'}, ${'also cached'}, NULL)`
  );
}

// regression: injected-sql-accelerates-query-reconciliation
test('an injected database keeps the production query refresh cadence', async () => {
  let requests = 0;
  const w = world(openMockingbird, {
    loadApp: () => Promise.resolve({ ...app, sessionQueries: ['probe'] }),
    fetchFn: () => {
      requests++;
      return Promise.resolve(
        Response.json({ responses: [{ status: 'not_modified' }] })
      );
    },
  });
  const engine = await boot(w);
  w.clock.clock.advance(0);
  await engine.waitForFirstSync();
  const initial = requests;
  for (let tick = 0; tick < 59; tick++) {
    w.clock.clock.advance(500);
    for (let turn = 0; turn < 100; turn++) await Promise.resolve();
  }
  expect(requests).toBe(initial);
  w.clock.clock.advance(500);
  await settles(() => requests > initial);
  expect(requests).toBe(initial + 1);
});

// regression: local-sqlite-failure-stops-boot
describe('a database that cannot be opened', () => {
  test('boots on a disposable database', async () => {
    const w = world(() => Promise.reject(new Error('no worker could start')));
    await expectUsable(await boot(w));
  });

  test.each(Object.keys(STORAGE_FAULTS) as (keyof typeof STORAGE_FAULTS)[])(
    'boots when the database is dead from the first call (%s)',
    async (name) => {
      const w = world(async () => {
        const faulty = createFaultInjectingSqlClient(await openMockingbird());
        faulty.breakWith(STORAGE_FAULTS[name]);
        return faulty.client;
      });
      await expectUsable(await boot(w));
    }
  );

  test('boots when the database hangs on its first call', async () => {
    const w = world(
      async () => {
        const faulty = createFaultInjectingSqlClient(await openMockingbird());
        faulty.hang();
        return faulty.client;
      },
      { localCallDeadlineMs: 5_000 }
    );
    const booting = boot(w);
    for (let turn = 0; turn < 50; turn += 1) await Bun.sleep(0);
    w.clock.clock.advance(5_000);
    await expectUsable(await booting);
  });
});

// regression: local-sqlite-failure-stops-boot
describe('a database that fails after the app is up', () => {
  test.each(Object.keys(STORAGE_FAULTS) as (keyof typeof STORAGE_FAULTS)[])(
    'keeps answering when it fails with %s',
    async (name) => {
      const faulty = createFaultInjectingSqlClient(await openMockingbird());
      const engine = await boot(world(() => Promise.resolve(faulty.client)));
      await seedItem(engine.db);
      expect(await engine.db.query(READ_ITEMS)).toHaveLength(1);

      faulty.breakWith(STORAGE_FAULTS[name]);

      // Whatever was cached is gone with the storage; the app carries on.
      expect(await engine.db.query(READ_ITEMS)).toEqual([]);
      await expectUsable(engine);
      expect(faulty.disconnects()).toBe(1);
    }
  );

  test('a write in flight when storage dies is not lost', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    faulty.breakWith(STORAGE_FAULTS.io);
    await engine.db.transaction(async (tx) => {
      await tx.run(
        sql`INSERT INTO probe_items (id, label, deleted_at) VALUES (${'w'}, ${'written'}, NULL)`
      );
    });
    expect(await engine.db.query(READ_ITEMS)).toEqual([
      { id: 'w', label: 'written' },
    ]);
  });

  test('a watch on the cache shows the fresh database after the failover', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    await seedItem(engine.db);
    const watch = engine.watch(READ_ITEMS);
    const stop = watch.subscribe(() => undefined);
    await settles(() => watch.getSnapshot().length === 1);

    faulty.breakWith(STORAGE_FAULTS.corrupt);
    await engine.db.query(READ_ITEMS);
    await settles(() => watch.getSnapshot().length === 0);

    expect(watch.getSnapshot()).toEqual([]);
    stop();
  });

  test('clearing local data on the fresh database works', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    faulty.breakWith(STORAGE_FAULTS.full);
    await engine.db.query(READ_ITEMS);
    await engine.clearLocalData({ reason: 'cache' });
    await expectUsable(engine);
  });

  test('the engine can be shut down while the storage is dead', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    faulty.breakWith(STORAGE_FAULTS.corrupt);
    await engine.disconnect();
    engines.length = 0;
  });
});

describe('a database that works', () => {
  test('keeps its cache and never fails over', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    await seedItem(engine.db);
    expect(await engine.db.query(READ_ITEMS)).toHaveLength(1);
    await seedExtra(engine.db);
    expect(await engine.db.query(READ_ITEMS)).toHaveLength(2);
    expect(faulty.disconnects()).toBe(0);
  });

  test('a statement the database refuses is reported and the cache stays', async () => {
    const faulty = createFaultInjectingSqlClient(await openMockingbird());
    const engine = await boot(world(() => Promise.resolve(faulty.client)));
    await seedItem(engine.db);
    await expect(
      engine.db.run(
        sql`INSERT INTO probe_items (id, label, deleted_at) VALUES (${'old'}, ${'twice'}, NULL)`
      )
    ).rejects.toThrow(/UNIQUE|constraint/i);
    expect(await engine.db.query(READ_ITEMS)).toHaveLength(1);
    expect(faulty.disconnects()).toBe(0);
  });
});

describe('any fault at any point', () => {
  test('never stops the engine from booting or answering', async () => {
    const faultNames = Object.keys(
      STORAGE_FAULTS
    ) as (keyof typeof STORAGE_FAULTS)[];
    await assertProperty(
      'a failing cache is replaced, never surfaced',
      fc.asyncProperty(
        fc.constantFrom(...faultNames),
        fc.constantFrom('before-open', 'at-open', 'after-boot'),
        async (name, when) => {
          const faulty = createFaultInjectingSqlClient(await openMockingbird());
          if (when === 'at-open') faulty.breakWith(STORAGE_FAULTS[name]);
          const engine = await boot(
            world(async () => {
              if (when === 'before-open') {
                throw STORAGE_FAULTS[name]();
              }
              return faulty.client;
            })
          );
          if (when === 'after-boot') faulty.breakWith(STORAGE_FAULTS[name]);
          await expectUsable(engine);
          await engine.disconnect();
          engines.length = 0;
        }
      )
    );
  }, 120_000);
});
