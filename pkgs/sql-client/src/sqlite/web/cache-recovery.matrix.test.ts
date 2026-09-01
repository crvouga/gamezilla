import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { wallTimers } from '@pkgs/clock';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '../../interface';
import { createBunSqlOwner } from '../web/owners/bun-sql-owner';
import { createMemorySqlOwner } from '../web/owners/memory-sql-owner';
import {
  corruptSimOpfsStore,
  createSimOpfsSqlOwner,
  createSimOpfsStore,
  fillSimOpfsPool,
  type SimOpfsStore,
} from '../web/owners/sim-opfs-sql-owner';
import { openSqlOwnerWithRecovery } from '../web/recover-in-process';
import type { SqlOwner } from '../web/sql-owner';

type Backend = {
  readonly name: string;
  readonly create: () => {
    owner: SqlOwner;
    store?: SimOpfsStore;
  };
  readonly supportsPool?: boolean;
};

const backends: Backend[] = [
  {
    name: 'sqlite-mem',
    create: () => ({ owner: createMemorySqlOwner({ dbName: 'kv' }) }),
  },
  {
    name: 'bun-sqlite',
    create: () => ({ owner: createBunSqlOwner({ dbName: 'kv' }) }),
  },
  {
    name: 'web-sim-opfs',
    create: () => {
      const store = createSimOpfsStore({ capacity: 6 });
      return {
        owner: createSimOpfsSqlOwner({ dbName: 'kv', store }),
        store,
      };
    },
    supportsPool: true,
  },
];

const VERSION_STRIDE = 1_000;

async function readUserVersion(client: SqlClient): Promise<number> {
  const rows = await client.query(
    raw<{ user_version: number }>('PRAGMA user_version')
  );
  return Number(rows[0]?.user_version ?? 0);
}

async function migrateToyKv(client: SqlClient, epoch: number): Promise<void> {
  const target = epoch * VERSION_STRIDE + 1;
  const previous = await readUserVersion(client);
  const previousEpoch = Math.floor(previous / VERSION_STRIDE);
  if (previousEpoch < epoch) {
    await client.run(raw('DROP TABLE IF EXISTS toy_kv'));
  }
  await client.run(
    raw('CREATE TABLE IF NOT EXISTS toy_kv (k TEXT PRIMARY KEY, v TEXT) STRICT')
  );
  await client.run(raw(`PRAGMA user_version = ${target}`));
}

describe.each(backends)(
  'cache recovery — $name',
  ({ name, create, supportsPool }) => {
    let owner: SqlOwner;
    let store: SimOpfsStore | undefined;

    beforeEach(() => {
      const built = create();
      owner = built.owner;
      store = built.store;
    });

    afterEach(async () => {
      await owner.close();
      await owner.resetStore();
    });

    test('open + write + read', async () => {
      const client = await openSqlOwnerWithRecovery({
        owner,
        timers: wallTimers,
        notifyPeers: false,
        migrate: (c) => migrateToyKv(c, 1),
      });
      await client.run(sql`INSERT INTO toy_kv (k, v) VALUES (${'a'}, ${'1'})`);
      const rows = await client.query(
        sql<{ k: string; v: string }>`SELECT k, v FROM toy_kv`
      );
      expect(rows).toEqual([{ k: 'a', v: '1' }]);
      void name;
    });

    test('resetStore yields empty cache on reopen', async () => {
      const client = await openSqlOwnerWithRecovery({
        owner,
        timers: wallTimers,
        notifyPeers: false,
        migrate: (c) => migrateToyKv(c, 1),
      });
      await client.run(sql`INSERT INTO toy_kv (k, v) VALUES (${'a'}, ${'1'})`);
      await owner.close();
      await owner.resetStore();
      const next = await openSqlOwnerWithRecovery({
        owner,
        timers: wallTimers,
        notifyPeers: false,
        migrate: (c) => migrateToyKv(c, 1),
      });
      const rows = await next.query(sql<{ k: string }>`SELECT k FROM toy_kv`);
      expect(rows).toEqual([]);
    });

    test('schema epoch bump wipes old rows', async () => {
      const client = await openSqlOwnerWithRecovery({
        owner,
        timers: wallTimers,
        notifyPeers: false,
        migrate: (c) => migrateToyKv(c, 1),
      });
      await client.run(
        sql`INSERT INTO toy_kv (k, v) VALUES (${'old'}, ${'x'})`
      );
      await owner.close();
      const next = await openSqlOwnerWithRecovery({
        owner,
        timers: wallTimers,
        notifyPeers: false,
        migrate: (c) => migrateToyKv(c, 2),
      });
      const rows = await next.query(sql<{ k: string }>`SELECT k FROM toy_kv`);
      expect(rows).toEqual([]);
      expect(await readUserVersion(next)).toBe(2 * VERSION_STRIDE + 1);
    });

    if (supportsPool) {
      test('pool exhaustion auto-wipes and opens', async () => {
        if (store === undefined) throw new Error('expected sim store');
        fillSimOpfsPool(store);
        const client = await openSqlOwnerWithRecovery({
          owner,
          timers: wallTimers,
          notifyPeers: false,
          migrate: (c) => migrateToyKv(c, 1),
        });
        await client.run(
          sql`INSERT INTO toy_kv (k, v) VALUES (${'ok'}, ${'1'})`
        );
        const rows =
          await client.query(sql<{ k: string }>`SELECT k FROM toy_kv`);
        expect(rows).toEqual([{ k: 'ok' }]);
      });

      test('corrupt store auto-wipes and opens', async () => {
        if (store === undefined) throw new Error('expected sim store');
        corruptSimOpfsStore(store);
        const client = await openSqlOwnerWithRecovery({
          owner,
          timers: wallTimers,
          notifyPeers: false,
          migrate: (c) => migrateToyKv(c, 1),
        });
        const rows = await client.query(
          sql<{
            name: string;
          }>`SELECT name FROM sqlite_master WHERE type='table'`
        );
        expect(rows.some((r) => r.name === 'toy_kv')).toBe(true);
      });
    }
  }
);
