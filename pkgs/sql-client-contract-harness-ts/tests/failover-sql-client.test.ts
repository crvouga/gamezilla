import { afterEach, describe, expect, test } from 'bun:test';
import type { FailoverSqlClientOptions } from '@pkgs/sql-client-root-shared-ts/failover-sql-client';
import { createFailoverSqlClient } from '@pkgs/sql-client-root-shared-ts/failover-sql-client';
import type { FaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  STATEMENT_ERRORS,
  STORAGE_FAULTS,
} from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

type Row = { k: string; v: string };

const READ_ALL = sql<Row>`SELECT k, v FROM kv ORDER BY k`;
const CREATE = sql`CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)`;

async function createSchema(client: SqlClient): Promise<void> {
  await client.run(CREATE);
}

function insert(k: string, v: string) {
  return sql`INSERT INTO kv (k, v) VALUES (${k}, ${v})`;
}

function manualTimers() {
  let nextId = 0;
  const pending = new Map<number, { fn: () => void; at: number }>();
  let now = 0;
  return {
    setTimeout: (fn: () => void, ms: number): unknown => {
      nextId += 1;
      pending.set(nextId, { fn, at: now + ms });
      return nextId;
    },
    clearTimeout: (handle: unknown): void => {
      pending.delete(handle as number);
    },
    advance: (ms: number): void => {
      now += ms;
      for (const [id, timer] of [...pending]) {
        if (timer.at <= now) {
          pending.delete(id);
          timer.fn();
        }
      }
    },
    pending: () => pending.size,
  };
}

const opened: SqlClient[] = [];

afterEach(async () => {
  while (opened.length > 0) {
    await opened.pop()?.disconnect();
  }
});

type World = {
  readonly faulty: FaultInjectingSqlClient;
  readonly client: ReturnType<typeof createFailoverSqlClient>;
  readonly fallbacksOpened: () => number;
  readonly failovers: unknown[];
};

async function world(
  overrides: Partial<FailoverSqlClientOptions> = {}
): Promise<World> {
  const faulty = faultyMockingbird();
  await faulty.client.connect();
  await createSchema(faulty.client);
  await faulty.client.run(insert('a', 'stored'));
  let fallbacks = 0;
  const failovers: unknown[] = [];
  const client = createFailoverSqlClient({
    primary: faulty.client,
    openFallback: async () => {
      fallbacks += 1;
      const fallback = SqlClientImplMockingbirdSqlite.open();
      await fallback.connect();
      opened.push(fallback);
      return fallback;
    },
    prepareFallback: createSchema,
    onFailover: (reason) => failovers.push(reason),
    ...overrides,
  });
  return { faulty, client, fallbacksOpened: () => fallbacks, failovers };
}

describe('a healthy database', () => {
  test('answers as itself and never fails over', async () => {
    const { client, faulty, failovers } = await world();
    expect(await client.query(READ_ALL)).toEqual([{ k: 'a', v: 'stored' }]);
    expect(await client.run(insert('b', 'two'))).toMatchObject({ changes: 1 });
    expect(
      await client.transaction(async (tx) => {
        await tx.run(insert('c', 'three'));
        return tx.query(READ_ALL);
      })
    ).toHaveLength(3);
    const prepared = client.prepare(sql<Row>`SELECT k, v FROM kv WHERE k = ?`);
    expect(await prepared.query(['b'])).toEqual([{ k: 'b', v: 'two' }]);
    expect(client.failedOver()).toBe(false);
    expect(failovers).toEqual([]);
    expect(faulty.disconnects()).toBe(0);
  });
});

describe('storage that fails', () => {
  test.each(Object.keys(STORAGE_FAULTS) as (keyof typeof STORAGE_FAULTS)[])(
    'a read after %s is answered by a fresh database',
    async (name) => {
      const { client, faulty, failovers, fallbacksOpened } = await world();
      faulty.breakWith(STORAGE_FAULTS[name]);
      expect(await client.query(READ_ALL)).toEqual([]);
      expect(client.failedOver()).toBe(true);
      expect(fallbacksOpened()).toBe(1);
      expect(failovers).toHaveLength(1);
      expect(faulty.disconnects()).toBe(1);
      await client.run(insert('x', 'after'));
      expect(await client.query(READ_ALL)).toEqual([{ k: 'x', v: 'after' }]);
    }
  );

  test('a write that met the failure lands on the fresh database', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.io);
    await client.run(insert('b', 'kept'));
    expect(await client.query(READ_ALL)).toEqual([{ k: 'b', v: 'kept' }]);
  });

  test('a failure once is enough, even when the primary heals', async () => {
    const { client, faulty, fallbacksOpened } = await world();
    faulty.failNextCallWith(STORAGE_FAULTS.corrupt());
    const before = faulty.calls();
    await client.query(READ_ALL);
    expect(client.failedOver()).toBe(true);
    await client.query(READ_ALL);
    await client.query(READ_ALL);
    expect(fallbacksOpened()).toBe(1);
    expect(faulty.calls() - before).toBe(1);
  });

  test('a wording nobody knows fails over when the probe also fails', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.unrecognised);
    expect(await client.query(READ_ALL)).toEqual([]);
    expect(client.failedOver()).toBe(true);
  });

  test('a wording nobody knows is reported when the database still answers', async () => {
    const { client, faulty, failovers } = await world();
    const odd = new Error('something unforeseen about this one statement');
    faulty.failNextCallWith(odd);
    await expect(client.query(READ_ALL)).rejects.toBe(odd);
    expect(client.failedOver()).toBe(false);
    expect(failovers).toEqual([]);
    expect(await client.query(READ_ALL)).toEqual([{ k: 'a', v: 'stored' }]);
  });

  test('many calls at once open exactly one replacement', async () => {
    const { client, faulty, fallbacksOpened, failovers } = await world();
    faulty.breakWith(STORAGE_FAULTS.corrupt);
    const answers = await Promise.all(
      Array.from({ length: 25 }, () => client.query(READ_ALL))
    );
    expect(answers.every((rows) => rows.length === 0)).toBe(true);
    expect(fallbacksOpened()).toBe(1);
    expect(failovers).toHaveLength(1);
  });

  test('prepared statements move to the fresh database', async () => {
    const { client, faulty } = await world();
    const byKey = client.prepare(sql<Row>`SELECT k, v FROM kv WHERE k = ?`);
    expect(await byKey.query(['a'])).toEqual([{ k: 'a', v: 'stored' }]);
    faulty.breakWith(STORAGE_FAULTS.io);
    expect(await byKey.query(['a'])).toEqual([]);
    await client.run(insert('a', 'again'));
    expect(await byKey.query(['a'])).toEqual([{ k: 'a', v: 'again' }]);
    const writer = client.prepare(
      sql<Row>`INSERT INTO kv (k, v) VALUES (?, ?)`
    );
    expect(await writer.run(['z', 'last'])).toMatchObject({ changes: 1 });
  });

  test('a failure in the fresh database is reported, not hidden', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.io);
    await client.query(READ_ALL);
    await expect(
      client.run(sql`INSERT INTO nowhere (x) VALUES (1)`)
    ).rejects.toThrow(/no such table/);
    expect(client.failedOver()).toBe(true);
  });
});

describe('what the database answers is reported as it would be', () => {
  test.each(Object.entries(STATEMENT_ERRORS))(
    '%s is thrown and the storage is kept',
    async (name, message) => {
      const { client, faulty, failovers } = await world();
      const error = new Error(message);
      faulty.failNextCallWith(error);
      await expect(client.run(insert('b', 'two'))).rejects.toBe(error);
      expect(client.failedOver(), name).toBe(false);
      expect(failovers).toEqual([]);
      expect(await client.query(READ_ALL)).toEqual([{ k: 'a', v: 'stored' }]);
    }
  );

  test('a real constraint violation keeps the stored data', async () => {
    const { client, failovers } = await world();
    await expect(client.run(insert('a', 'dup'))).rejects.toThrow(
      /UNIQUE|constraint/i
    );
    await expect(client.query(sql<Row>`SELECT * FROM missing`)).rejects.toThrow(
      /no such table/
    );
    expect(client.failedOver()).toBe(false);
    expect(failovers).toEqual([]);
    expect(await client.query(READ_ALL)).toEqual([{ k: 'a', v: 'stored' }]);
  });
});

describe('transactions', () => {
  test('an error from the caller rolls back and is not a failure', async () => {
    const { client, failovers } = await world();
    const refusal = new Error('NO_HARD_DELETE');
    await expect(
      client.transaction(async (tx) => {
        await tx.run(insert('b', 'half'));
        throw refusal;
      })
    ).rejects.toBe(refusal);
    expect(client.failedOver()).toBe(false);
    expect(failovers).toEqual([]);
    expect(await client.query(READ_ALL)).toEqual([{ k: 'a', v: 'stored' }]);
  });

  test('a caller error that reads like a storage failure is still the caller’s', async () => {
    const { client } = await world();
    const lookalike = new Error('SQLITE_CORRUPT said the validation rule');
    await expect(
      client.transaction(async () => {
        throw lookalike;
      })
    ).rejects.toBe(lookalike);
    expect(client.failedOver()).toBe(false);
  });

  test('a statement error inside the body reaches the body and the caller', async () => {
    const { client } = await world();
    await expect(
      client.transaction(async (tx) => {
        await tx.run(insert('a', 'dup'));
      })
    ).rejects.toThrow(/UNIQUE|constraint/i);
    expect(client.failedOver()).toBe(false);
  });

  test('a body that handles a statement error carries on', async () => {
    const { client } = await world();
    const result = await client.transaction(async (tx) => {
      try {
        await tx.run(insert('a', 'dup'));
      } catch {
        await tx.run(sql`UPDATE kv SET v = 'merged' WHERE k = 'a'`);
      }
      return tx.query(READ_ALL);
    });
    expect(result).toEqual([{ k: 'a', v: 'merged' }]);
  });

  test('a body runs again on the fresh database when storage fails first', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.corrupt);
    let runs = 0;
    const rows = await client.transaction(async (tx) => {
      runs += 1;
      await tx.run(insert('t', 'tx'));
      return tx.query(READ_ALL);
    });
    expect(rows).toEqual([{ k: 't', v: 'tx' }]);
    expect(runs).toBe(1);
    expect(client.failedOver()).toBe(true);
  });

  test('storage that fails inside the body fails over and runs it again', async () => {
    const { client, faulty } = await world();
    let runs = 0;
    const rows = await client.transaction(async (tx) => {
      runs += 1;
      if (runs === 1) faulty.breakWith(STORAGE_FAULTS.io);
      await tx.run(insert('t', 'tx'));
      return tx.query(READ_ALL);
    });
    expect(rows).toEqual([{ k: 't', v: 'tx' }]);
    expect(runs).toBe(2);
  });

  test('a nested transaction joins the outer one', async () => {
    const { client } = await world();
    const rows = await client.transaction(async (outer) =>
      outer.transaction(async (inner) => {
        await inner.run(insert('n', 'nested'));
        return inner.query(READ_ALL);
      })
    );
    expect(rows).toHaveLength(2);
  });
});

describe('a database that hangs', () => {
  test('a call outlasting the deadline is a failure', async () => {
    const timers = manualTimers();
    const { client, faulty } = await world({
      deadline: { timers, ms: 5000 },
    });
    faulty.hang();
    const answer = client.query(READ_ALL);
    timers.advance(5000);
    expect(await answer).toEqual([]);
    expect(client.failedOver()).toBe(true);
  });

  test('a call that answers in time leaves no timer behind', async () => {
    const timers = manualTimers();
    const { client } = await world({ deadline: { timers, ms: 5000 } });
    await client.query(READ_ALL);
    await client.run(insert('b', 'two'));
    expect(timers.pending()).toBe(0);
    expect(client.failedOver()).toBe(false);
  });

  test('a hung connect fails over', async () => {
    const timers = manualTimers();
    const { client, faulty } = await world({ deadline: { timers, ms: 8000 } });
    faulty.hang();
    const connected = client.connect();
    timers.advance(8000);
    await connected;
    expect(client.failedOver()).toBe(true);
    expect(await client.query(READ_ALL)).toEqual([]);
  });
});

describe('connecting', () => {
  test('a database that will not open is replaced', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.cantOpen);
    await client.connect();
    expect(client.failedOver()).toBe(true);
  });

  test('connecting again after the failover is harmless', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.cantOpen);
    await client.connect();
    await client.connect();
    expect(await client.query(READ_ALL)).toEqual([]);
  });
});

describe('the last resort', () => {
  test('a replacement that cannot open is reported, then tried again', async () => {
    let attempts = 0;
    const { client, faulty } = await world({
      openFallback: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('no memory either');
        const fallback = SqlClientImplMockingbirdSqlite.open();
        await fallback.connect();
        opened.push(fallback);
        return fallback;
      },
    });
    faulty.breakWith(STORAGE_FAULTS.io);
    await expect(client.query(READ_ALL)).rejects.toThrow('no memory either');
    expect(client.failedOver()).toBe(false);
    expect(await client.query(READ_ALL)).toEqual([]);
    expect(client.failedOver()).toBe(true);
  });

  test('a replacement that cannot be readied is closed and not used', async () => {
    const { client, faulty } = await world({
      prepareFallback: async () => {
        throw new Error('schema failed');
      },
    });
    faulty.breakWith(STORAGE_FAULTS.io);
    await expect(client.query(READ_ALL)).rejects.toThrow('schema failed');
    expect(client.failedOver()).toBe(false);
  });

  test('a failing report of the failover does not undo it', async () => {
    const { client, faulty } = await world({
      onFailover: () => {
        throw new Error('reporter down');
      },
    });
    faulty.breakWith(STORAGE_FAULTS.io);
    expect(await client.query(READ_ALL)).toEqual([]);
    expect(client.failedOver()).toBe(true);
  });
});

describe('the rest of a browser database', () => {
  test('changes in other tabs are relayed until the failover', async () => {
    const { client, faulty } = await world();
    let heard = 0;
    const stop = client.onChanged?.(() => {
      heard += 1;
    });
    faulty.notifyChanged();
    expect(heard).toBe(1);
    faulty.breakWith(STORAGE_FAULTS.io);
    await client.query(READ_ALL);
    faulty.notifyChanged();
    expect(heard).toBe(1);
    stop?.();
  });

  test('a database without those parts shows none', async () => {
    const plain = SqlClientImplMockingbirdSqlite.open();
    await plain.connect();
    opened.push(plain);
    const client = createFailoverSqlClient({
      primary: plain,
      openFallback: () => Promise.resolve(plain),
    });
    expect(client.resetDatabase).toBeUndefined();
    expect(client.onChanged).toBeUndefined();
  });

  test('resetting a healthy database resets it', async () => {
    const { client, faulty } = await world();
    await client.resetDatabase?.();
    expect(faulty.resets()).toBe(1);
    expect(client.failedOver()).toBe(false);
  });

  test('resetting a database that cannot reset fails over instead', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.io);
    await client.resetDatabase?.();
    expect(client.failedOver()).toBe(true);
  });

  test('resetting the fresh database empties it', async () => {
    const { client, faulty } = await world();
    faulty.breakWith(STORAGE_FAULTS.io);
    await client.run(insert('k', 'v'));
    await client.resetDatabase?.();
    expect(await client.query(READ_ALL)).toEqual([]);
    await client.run(insert('k', 'again'));
    expect(await client.query(READ_ALL)).toEqual([{ k: 'k', v: 'again' }]);
  });

  test('disconnecting never throws', async () => {
    const { client } = await world({
      primary: {
        ...faultyMockingbird().client,
        disconnect: () => Promise.reject(new Error('already gone')),
      },
    });
    await client.disconnect();
  });
});

function faultyMockingbird(): FaultInjectingSqlClient {
  return createFaultInjectingSqlClient(SqlClientImplMockingbirdSqlite.open());
}
