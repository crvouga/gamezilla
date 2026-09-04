import { expect, type Page, test } from '@playwright/test';
import { kvDdl } from '../helpers/kv-schema';

declare global {
  interface Window {
    __sqlHarness: unknown;
  }
}

async function harness(page: Page) {
  return page.evaluateHandle(() => window.__sqlHarness);
}

async function call<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ({ fn, args }) => {
      const h = window.__sqlHarness as unknown as Record<
        string,
        (...a: unknown[]) => Promise<unknown> | unknown
      >;
      return h[fn]?.(...args) as T;
    },
    { fn, args }
  );
}

async function migrateKv(page: Page, dbName: string): Promise<void> {
  for (const stmt of kvDdl) {
    await call(page, 'run', dbName, stmt);
  }
}

test.describe('multi-tab sql-client', () => {
  test('two tabs share one db: write in A readable in B + change notify', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

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

    await expect
      .poll(async () => call<number>(tabB, 'changedCount'))
      .toBeGreaterThan(0);

    const rows = await call<Array<{ id: string; k: string; v: string }>>(
      tabB,
      'query',
      'db_shared',
      'SELECT * FROM kv'
    );
    expect(rows).toEqual([{ id: '1', k: 'a', v: '1' }]);
    await context.close();
  });

  test('two different dbs do not interfere', async ({ browser }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

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
    await context.close();
  });

  test('closing owner promotes survivor (SharedWorker path)', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

    await call(tabA, 'connect', 'db_failover_sw');
    await call(tabB, 'connect', 'db_failover_sw');
    await migrateKv(tabA, 'db_failover_sw');

    await call(tabA, 'disconnect');
    await tabA.close();

    await expect
      .poll(
        async () => {
          try {
            await call(
              tabB,
              'run',
              'db_failover_sw',
              'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
              ['1', 'after', '1']
            );
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    const rows = await call<Array<{ k: string }>>(
      tabB,
      'query',
      'db_failover_sw',
      'SELECT * FROM kv'
    );
    expect(rows.some((r) => r.k === 'after')).toBe(true);
    await context.close();
  });

  test('closing owner promotes survivor (leader path)', async ({ browser }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/?leader=1');
    await tabB.goto('/?leader=1');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

    await call(tabA, 'connect', 'db_failover');
    await call(tabB, 'connect', 'db_failover');
    await migrateKv(tabA, 'db_failover');

    await call(tabA, 'disconnect');
    await tabA.close();

    await expect
      .poll(
        async () => {
          try {
            await call(
              tabB,
              'run',
              'db_failover',
              'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
              ['1', 'after', '1']
            );
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    const rows = await call<Array<{ k: string }>>(
      tabB,
      'query',
      'db_failover',
      'SELECT * FROM kv'
    );
    expect(rows.some((r) => r.k === 'after')).toBe(true);
    await context.close();
  });

  test('wipe-channel prepare-wipe disconnects peer and wipe-done notifies', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

    await call(tabA, 'connect', 'db_wipe');
    await call(tabB, 'connect', 'db_wipe');

    const ready = await call<number>(tabA, 'prepareWipe');
    expect(ready).toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => call<number>(tabB, 'wipeReadySent'))
      .toBeGreaterThanOrEqual(1);

    await call(tabA, 'postWipeDone');
    await expect
      .poll(async () => call<number>(tabB, 'wipeDoneCount'))
      .toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test('hard-refresh loop does not throw locked-handle open errors', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (let i = 0; i < 10; i++) {
      await page.goto('/');
      await page.waitForFunction(() => window.__sqlHarness !== undefined);
      await call(page, 'connect', 'db_refresh');
      await migrateKv(page, 'db_refresh');
      await call(page, 'disconnect');
    }
    await context.close();
  });

  test('abandoned tx from closed tab does not block next tx', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');
    await tabA.waitForFunction(() => window.__sqlHarness !== undefined);
    await tabB.waitForFunction(() => window.__sqlHarness !== undefined);

    await call(tabA, 'connect', 'db_tx');
    await call(tabB, 'connect', 'db_tx');
    await migrateKv(tabA, 'db_tx');
    await call(tabA, 'beginAbandonedTx', 'db_tx');
    // pagehide → disconnect releases broker refs / rolls back owner tx.
    await call(tabA, 'disconnect');
    await tabA.close();

    await expect
      .poll(
        async () => {
          try {
            await call(
              tabB,
              'run',
              'db_tx',
              'INSERT INTO kv (id, k, v) VALUES (?, ?, ?)',
              ['1', 'ok', '1']
            );
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 20_000 }
      )
      .toBe(true);
    await context.close();
  });
});

void harness;
