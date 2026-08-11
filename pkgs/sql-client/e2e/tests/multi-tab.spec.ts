import { expect, type Page, test } from '@playwright/test';

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

    await call(
      tabA,
      'run',
      'db_shared',
      'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
    );
    await call(
      tabA,
      'run',
      'db_shared',
      'INSERT INTO kv (k, v) VALUES (?, ?)',
      ['a', '1']
    );

    await expect
      .poll(async () => call<number>(tabB, 'changedCount'))
      .toBeGreaterThan(0);

    const rows = await call<Array<{ k: string; v: string }>>(
      tabB,
      'query',
      'db_shared',
      'SELECT * FROM kv'
    );
    expect(rows).toEqual([{ k: 'a', v: '1' }]);
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
    await call(
      tabA,
      'run',
      'db_one',
      'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
    );
    await call(
      tabB,
      'run',
      'db_two',
      'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
    );
    await call(tabA, 'run', 'db_one', 'INSERT INTO kv (k, v) VALUES (?, ?)', [
      'x',
      '1',
    ]);
    await call(tabB, 'run', 'db_two', 'INSERT INTO kv (k, v) VALUES (?, ?)', [
      'y',
      '2',
    ]);

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
    await call(
      tabA,
      'run',
      'db_failover',
      'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
    );

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
              'INSERT INTO kv (k, v) VALUES (?, ?)',
              ['after', '1']
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

  test('hard-refresh loop does not throw locked-handle open errors', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (let i = 0; i < 10; i++) {
      await page.goto('/');
      await page.waitForFunction(() => window.__sqlHarness !== undefined);
      await call(page, 'connect', 'db_refresh');
      await call(
        page,
        'run',
        'db_refresh',
        'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
      );
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
    await call(
      tabA,
      'run',
      'db_tx',
      'CREATE TABLE IF NOT EXISTS kv (k TEXT, v TEXT)'
    );
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
              'INSERT INTO kv (k, v) VALUES (?, ?)',
              ['ok', '1']
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
