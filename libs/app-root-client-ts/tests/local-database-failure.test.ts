import { afterEach, describe, expect, test } from 'bun:test';
import type { CreateAppLocalSyncEngineArgs } from '@libs/app-env-client-ts/create-local-sync-engine';
import { createAppLocalSyncEngine } from '@libs/app-env-client-ts/create-local-sync-engine';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { STORAGE_FAULTS } from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';

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

// regression: sqlite-boot-discards-durable-storage
describe('an unavailable durable database', () => {
  test('reports an open failure without starting on empty storage', async () => {
    await expect(
      boot(world(() => Promise.reject(new Error('no worker could start'))))
    ).rejects.toThrow('no worker could start');
  });

  test.each(Object.keys(STORAGE_FAULTS) as (keyof typeof STORAGE_FAULTS)[])(
    'reports a failed database call without discarding the saved rows (%s)',
    async (name) => {
      const db = await openMockingbird();
      const faulty = createFaultInjectingSqlClient(db);
      const engine = await boot(world(() => Promise.resolve(faulty.client)));
      await seedItem(engine.db);
      faulty.breakWith(STORAGE_FAULTS[name]);
      await expect(engine.db.query(READ_ITEMS)).rejects.toThrow();
      expect(await db.query(READ_ITEMS)).toEqual([
        { id: 'old', label: 'cached' },
      ]);
    }
  );
});

// regression: sqlite-boot-waits-for-app-before-opening
test('starts opening saved data while application code is still loading', async () => {
  const loading = Promise.withResolvers<typeof app>();
  const opening = Promise.withResolvers<void>();
  const w = world(
    async () => {
      opening.resolve();
      return openMockingbird();
    },
    { loadApp: () => loading.promise }
  );
  const booting = boot(w);
  await opening.promise;
  loading.resolve(app);
  await expectUsable(await booting);
});

// regression: sqlite-boot-discards-durable-storage
test('a new engine exposes saved rows before any network response', async () => {
  const db = await openMockingbird();
  const first = await boot(world(() => Promise.resolve(db)));
  await seedItem(first.db);
  await first.disconnect();
  const w = world(() => Promise.resolve(db), {
    fetchFn: () => Promise.reject(new Error('offline')),
  });
  const next = await createAppLocalSyncEngine(w.args);
  engines.push(next);
  expect(await next.db.query(READ_ITEMS)).toEqual([
    { id: 'old', label: 'cached' },
  ]);
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

test('releases the database when application loading fails', async () => {
  const faulty = createFaultInjectingSqlClient(await openMockingbird());
  const w = world(() => Promise.resolve(faulty.client), {
    loadApp: () => Promise.reject(new Error('application unavailable')),
  });
  await expect(boot(w)).rejects.toThrow('application unavailable');
  expect(faulty.disconnects()).toBe(1);
});
