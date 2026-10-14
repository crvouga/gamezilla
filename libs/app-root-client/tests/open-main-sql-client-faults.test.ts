import { afterEach, describe, expect, test } from 'bun:test';
import {
  isDisposableSqlClient,
  LOCAL_DATABASE_OPEN_DEADLINE_MS,
  openMainSqlClient,
} from '@libs/app-root-client/open-main-sql-client';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import fc from 'fast-check';

const ONE = sql<{ one: number }>`SELECT 1 AS one`;

const opened: SqlClient[] = [];

afterEach(async () => {
  while (opened.length > 0) await opened.pop()?.disconnect();
});

async function open(
  createClient: Parameters<typeof openMainSqlClient>[3],
  clock = createHarnessClock()
): Promise<SqlClient> {
  const client = await openMainSqlClient(
    'alice',
    clock.timers,
    createNoopLogger(),
    createClient
  );
  opened.push(client);
  return client;
}

function healthy(): SqlClient {
  return SqlClientImplMockingbirdSqlite.open();
}

describe('opening the local database', () => {
  test('hands back the real database when it opens', async () => {
    const real = healthy();
    const client = await open(() => real);
    expect(client).toBe(real);
    expect(isDisposableSqlClient(client)).toBe(false);
  });

  test('lands on a working disposable database when connect fails', async () => {
    const client = await open(() => {
      const faulty = createFaultInjectingSqlClient(healthy());
      faulty.breakWith(() => new Error('SQLITE_CANTOPEN: unable to open'));
      return faulty.client;
    });
    expect(isDisposableSqlClient(client)).toBe(true);
    expect(await client.query(ONE)).toEqual([{ one: 1 }]);
  });

  test('lands on a working disposable database when building the client throws', async () => {
    const client = await open(() => {
      throw new Error('SharedWorker construction failed');
    });
    expect(isDisposableSqlClient(client)).toBe(true);
    expect(await client.query(ONE)).toEqual([{ one: 1 }]);
  });

  test('gives up on an open that never finishes, and lets it go', async () => {
    const clock = createHarnessClock();
    const faulty = createFaultInjectingSqlClient(healthy());
    faulty.hang();
    const opening = open(() => faulty.client, clock);
    for (let turn = 0; turn < 20; turn += 1) await Bun.sleep(0);
    clock.clock.advance(LOCAL_DATABASE_OPEN_DEADLINE_MS);

    const client = await opening;

    expect(isDisposableSqlClient(client)).toBe(true);
    expect(await client.query(ONE)).toEqual([{ one: 1 }]);
    expect(faulty.disconnects()).toBe(1);
  });

  test('an open that finishes in time leaves no timer running', async () => {
    const clock = createHarnessClock();
    await open(() => healthy(), clock);
    expect(clock.clock.pendingOneShotCount()).toBe(0);
  });

  test('a stuck open that finishes late is not used', async () => {
    const clock = createHarnessClock();
    const inner = healthy();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: SqlClient = {
      ...inner,
      connect: async () => {
        await gate;
        await inner.connect();
      },
      disconnect: () => inner.disconnect(),
      query: (query) => inner.query(query),
      run: (query) => inner.run(query),
      prepare: (query) => inner.prepare(query),
      transaction: (body) => inner.transaction(body),
    };
    const opening = open(() => slow, clock);
    for (let turn = 0; turn < 20; turn += 1) await Bun.sleep(0);
    clock.clock.advance(LOCAL_DATABASE_OPEN_DEADLINE_MS);
    const client = await opening;
    release();
    expect(client).not.toBe(slow);
    expect(isDisposableSqlClient(client)).toBe(true);
  });
});

describe('whatever the open throws', () => {
  test('a database always comes back', async () => {
    await assertProperty(
      'openMainSqlClient never rejects',
      fc.asyncProperty(
        fc.oneof(
          fc.string().map((message) => new Error(message)),
          fc.string(),
          fc.integer(),
          fc.constant(undefined),
          fc.constant(null)
        ),
        fc.constantFrom('build', 'connect'),
        async (thrown, where) => {
          const client = await open(() => {
            if (where === 'build') throw thrown;
            const faulty = createFaultInjectingSqlClient(healthy());
            faulty.breakWith(() => thrown as Error);
            return faulty.client;
          });
          expect(await client.query(ONE)).toEqual([{ one: 1 }]);
          await client.disconnect();
          opened.length = 0;
        }
      )
    );
  });
});
