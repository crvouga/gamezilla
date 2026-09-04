import { beforeAll, describe, expect, test } from 'bun:test';
import {
  type EvalView,
  openView,
  waitFor,
  waitForHttp,
} from '@pkgs/sql-client-sqlite/webview';
import { kvDdl } from '../helpers/kv-schema';

const ORIGIN = 'http://127.0.0.1:4177';

beforeAll(async () => {
  await waitForHttp(ORIGIN);
});

async function call<T>(
  view: EvalView,
  fn: string,
  ...args: unknown[]
): Promise<T> {
  const raw = await view.evaluate(
    `(async function(){
      var h = window.__sqlHarness;
      var result = await h[${JSON.stringify(fn)}].apply(h, ${JSON.stringify(args)});
      return JSON.stringify(result === undefined ? null : result);
    })()`
  );
  if (typeof raw !== 'string') {
    throw new Error(`call expected string, got ${typeof raw}`);
  }
  return JSON.parse(raw) as T;
}

async function migrateKv(view: EvalView, dbName: string): Promise<void> {
  for (const stmt of kvDdl) {
    await call(view, 'run', dbName, stmt);
  }
}

async function ready(view: ReturnType<typeof openView>, url = `${ORIGIN}/`) {
  await view.navigate(url);
  await waitFor(view, 'window.__sqlHarness !== undefined');
}

describe('multi-tab sql-client', () => {
  test('two tabs share one db: write in A readable in B + change notify', async () => {
    const tabA = openView(`${ORIGIN}/`);
    const tabB = openView(`${ORIGIN}/`);
    try {
      await ready(tabA);
      await ready(tabB);
      const roleA = await call<{ role: string }>(tabA, 'connect', 'db_shared');
      const roleB = await call<{ role: string }>(tabB, 'connect', 'db_shared');
      expect([roleA.role, roleB.role].sort().join(',')).toBe('owner,proxy');
      await migrateKv(tabA, 'db_shared');
      await call(
        tabA,
        'run',
        'db_shared',
        'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
        ['1', 'a', '1']
      );
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const n = await call<number>(tabB, 'changedCount');
        if (n > 0) break;
        await Bun.sleep(50);
      }
      expect(await call<number>(tabB, 'changedCount')).toBeGreaterThan(0);
      const rows = await call<Array<{ id: string; k: string; v: string }>>(
        tabB,
        'query',
        'db_shared',
        'SELECT * FROM kv'
      );
      expect(rows).toEqual([{ id: '1', k: 'a', v: '1' }]);
    } finally {
      tabA.close();
      tabB.close();
    }
  });

  test('two different dbs do not interfere', async () => {
    const tabA = openView(`${ORIGIN}/`);
    const tabB = openView(`${ORIGIN}/`);
    try {
      await ready(tabA);
      await ready(tabB);
      await call(tabA, 'connect', 'db_one');
      await call(tabB, 'connect', 'db_two');
      await migrateKv(tabA, 'db_one');
      await migrateKv(tabB, 'db_two');
      await call(
        tabA,
        'run',
        'db_one',
        'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
        ['1', 'x', '1']
      );
      await call(
        tabB,
        'run',
        'db_two',
        'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
        ['2', 'y', '2']
      );
      const aRows = await call<Array<{ k: string }>>(
        tabA,
        'query',
        'db_one',
        'SELECT * FROM kv'
      );
      const bRows = await call<Array<{ k: string }>>(
        tabB,
        'query',
        'db_two',
        'SELECT * FROM kv'
      );
      expect(aRows.map((r) => r.k)).toEqual(['x']);
      expect(bRows.map((r) => r.k)).toEqual(['y']);
    } finally {
      tabA.close();
      tabB.close();
    }
  });

  test('closing owner promotes survivor (SharedWorker path)', async () => {
    const tabA = openView(`${ORIGIN}/`);
    const tabB = openView(`${ORIGIN}/`);
    try {
      await ready(tabA);
      await ready(tabB);
      await call(tabA, 'connect', 'db_failover_sw');
      await call(tabB, 'connect', 'db_failover_sw');
      await migrateKv(tabA, 'db_failover_sw');
      await call(tabA, 'disconnect');
      tabA.close();
      const deadline = Date.now() + 20_000;
      let ok = false;
      while (Date.now() < deadline) {
        try {
          await call(
            tabB,
            'run',
            'db_failover_sw',
            'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
            ['1', 'after', '1']
          );
          ok = true;
          break;
        } catch {
          await Bun.sleep(100);
        }
      }
      expect(ok).toBe(true);
      const rows = await call<Array<{ k: string }>>(
        tabB,
        'query',
        'db_failover_sw',
        'SELECT * FROM kv'
      );
      expect(rows.some((r) => r.k === 'after')).toBe(true);
    } finally {
      tabB.close();
    }
  });

  test('closing owner promotes survivor (leader path)', async () => {
    const tabA = openView(`${ORIGIN}/?leader=1`);
    const tabB = openView(`${ORIGIN}/?leader=1`);
    try {
      await ready(tabA, `${ORIGIN}/?leader=1`);
      await ready(tabB, `${ORIGIN}/?leader=1`);
      await call(tabA, 'connect', 'db_failover');
      await call(tabB, 'connect', 'db_failover');
      await migrateKv(tabA, 'db_failover');
      await call(tabA, 'disconnect');
      tabA.close();
      const deadline = Date.now() + 20_000;
      let ok = false;
      while (Date.now() < deadline) {
        try {
          await call(
            tabB,
            'run',
            'db_failover',
            'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
            ['1', 'after', '1']
          );
          ok = true;
          break;
        } catch {
          await Bun.sleep(100);
        }
      }
      expect(ok).toBe(true);
      const rows = await call<Array<{ k: string }>>(
        tabB,
        'query',
        'db_failover',
        'SELECT * FROM kv'
      );
      expect(rows.some((r) => r.k === 'after')).toBe(true);
    } finally {
      tabB.close();
    }
  });

  test('wipe-channel prepare-wipe disconnects peer and wipe-done notifies', async () => {
    const tabA = openView(`${ORIGIN}/`);
    const tabB = openView(`${ORIGIN}/`);
    try {
      await ready(tabA);
      await ready(tabB);
      await call(tabA, 'connect', 'db_wipe');
      await call(tabB, 'connect', 'db_wipe');
      const readyCount = await call<number>(tabA, 'prepareWipe');
      expect(readyCount).toBeGreaterThanOrEqual(1);
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if ((await call<number>(tabB, 'wipeReadySent')) >= 1) break;
        await Bun.sleep(50);
      }
      expect(await call<number>(tabB, 'wipeReadySent')).toBeGreaterThanOrEqual(
        1
      );
      await call(tabA, 'postWipeDone');
      const doneDeadline = Date.now() + 15_000;
      while (Date.now() < doneDeadline) {
        if ((await call<number>(tabB, 'wipeDoneCount')) >= 1) break;
        await Bun.sleep(50);
      }
      expect(await call<number>(tabB, 'wipeDoneCount')).toBeGreaterThanOrEqual(
        1
      );
    } finally {
      tabA.close();
      tabB.close();
    }
  });

  test('hard-refresh loop does not throw locked-handle open errors', async () => {
    const page = openView(`${ORIGIN}/`);
    try {
      for (let i = 0; i < 10; i++) {
        await ready(page);
        await call(page, 'connect', 'db_refresh');
        await migrateKv(page, 'db_refresh');
        await call(page, 'disconnect');
      }
    } finally {
      page.close();
    }
  });

  test('abandoned tx from closed tab does not block next tx', async () => {
    const tabA = openView(`${ORIGIN}/`);
    const tabB = openView(`${ORIGIN}/`);
    try {
      await ready(tabA);
      await ready(tabB);
      await call(tabA, 'connect', 'db_tx');
      await call(tabB, 'connect', 'db_tx');
      await migrateKv(tabA, 'db_tx');
      await call(tabA, 'beginAbandonedTx', 'db_tx');
      await call(tabA, 'disconnect');
      tabA.close();
      const deadline = Date.now() + 20_000;
      let ok = false;
      while (Date.now() < deadline) {
        try {
          await call(
            tabB,
            'run',
            'db_tx',
            'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
            ['1', 'ok', '1']
          );
          ok = true;
          break;
        } catch {
          await Bun.sleep(100);
        }
      }
      expect(ok).toBe(true);
    } finally {
      tabB.close();
    }
  });
});
