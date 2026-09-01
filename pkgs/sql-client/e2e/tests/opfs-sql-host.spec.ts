import { expect, test } from '@playwright/test';
import { kvDdl } from '../helpers/kv-schema';

/**
 * Real Chromium OPFS pins — do not duplicate Happy DOM / DST protocol coverage.
 * Requires `bun run --filter @pkgs/sql-client build:web-workers` (via test:e2e).
 */

test.describe('expo-sqlite OPFS via sql-host iframe', () => {
  test('open user_* db, write, read', async ({ page }) => {
    await page.goto('/sql-workers/sql-host.html');
    await page.waitForFunction(() => window.__sqlHost !== undefined);
    await page.evaluate(async (ddl) => {
      const host = window.__sqlHost!;
      await host.open('user_6b3822ef08e0');
      for (const stmt of ddl) await host.run(stmt);
      await host.run('DELETE FROM kv');
      await host.run('INSERT INTO kv (id, k, v) VALUES (?, ?, ?)', [
        '1',
        'a',
        '1',
      ]);
    }, kvDdl);
    const rows = await page.evaluate(async () => {
      return window.__sqlHost!.query('SELECT k, v FROM kv');
    });
    expect(rows).toEqual([{ k: 'a', v: '1' }]);
  });

  test('resetStore clears OPFS; remount reopen is empty', async ({ page }) => {
    await page.goto('/sql-workers/sql-host.html');
    await page.waitForFunction(() => window.__sqlHost !== undefined);
    await page.evaluate(async (ddl) => {
      const host = window.__sqlHost!;
      await host.open('user_deadbeef0001');
      for (const stmt of ddl) await host.run(stmt);
      await host.run('INSERT INTO kv (id, k) VALUES (?, ?)', ['1', 'x']);
      await host.resetStore();
    }, kvDdl);
    // Remount required: expo-sqlite's Worker singleton dies with terminate.
    await page.reload();
    await page.waitForFunction(() => window.__sqlHost !== undefined);
    await page.evaluate(async () => {
      await window.__sqlHost!.open('user_deadbeef0001');
    });
    const tables = await page.evaluate(async () => {
      return window.__sqlHost!.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );
    });
    expect(tables).toEqual([]);
  });

  test('iframe recycle releases handles; second mount opens', async ({
    page,
  }) => {
    await page.goto('/');
    const result = await page.evaluate(
      async (ddl) => {
        async function mount(): Promise<{
          open: (n: string) => Promise<void>;
          run: (s: string, v?: unknown[]) => Promise<unknown>;
          query: (s: string) => Promise<unknown>;
          destroy: () => void;
        }> {
          const frame = document.createElement('iframe');
          frame.src = '/sql-workers/sql-host.html';
          document.body.appendChild(frame);
          await new Promise<void>((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
              if (event.source !== frame.contentWindow) return;
              const data = event.data as { type?: string; source?: string };
              if (data?.type === 'ready' && data.source === 'sql-host') {
                window.removeEventListener('message', onMessage);
                resolve();
              }
            };
            window.addEventListener('message', onMessage);
            frame.addEventListener('error', () =>
              reject(new Error('iframe load failed'))
            );
          });
          const host = (
            frame.contentWindow as Window & {
              __sqlHost: {
                open: (n: string) => Promise<void>;
                run: (s: string, v?: unknown[]) => Promise<unknown>;
                query: (s: string) => Promise<unknown>;
              };
            }
          ).__sqlHost;
          return {
            open: (n) => host.open(n),
            run: (s, v) => host.run(s, v),
            query: (s) => host.query(s),
            destroy: () => {
              frame.remove();
            },
          };
        }

        const first = await mount();
        await first.open('user_recycle00001');
        for (const stmt of ddl) await first.run(stmt);
        await first.run('INSERT INTO kv (id, k) VALUES (?, ?)', ['1', '1']);
        first.destroy();

        const second = await mount();
        await second.open('user_recycle00001');
        const rows = (await second.query('SELECT k FROM kv')) as Array<{
          k: string;
        }>;
        second.destroy();
        return rows;
      },
      kvDdl
    );
    expect(result).toEqual([{ k: '1' }]);
  });

  test('pre-seeded OPFS junk beyond pool capacity auto-recovers via remount wipe', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('expo-sqlite', {
        create: true,
      });
      for (let i = 0; i < 12; i++) {
        const file = await dir.getFileHandle(`junk-${i}`, { create: true });
        const writable = await file.createWritable();
        await writable.write(new Uint8Array([0, 1, 2, 3]));
        await writable.close();
      }
    });

    const opened = await page.evaluate(async () => {
      async function mountAndOpen(): Promise<boolean> {
        const frame = document.createElement('iframe');
        frame.src = '/sql-workers/sql-host.html';
        document.body.appendChild(frame);
        await new Promise<void>((resolve, reject) => {
          const onMessage = (event: MessageEvent) => {
            if (event.source !== frame.contentWindow) return;
            const data = event.data as { type?: string; source?: string };
            if (data?.type === 'ready' && data.source === 'sql-host') {
              window.removeEventListener('message', onMessage);
              resolve();
            }
          };
          window.addEventListener('message', onMessage);
          frame.addEventListener('error', () =>
            reject(new Error('iframe load failed'))
          );
        });
        const host = (
          frame.contentWindow as Window & {
            __sqlHost: {
              open: (n: string) => Promise<void>;
              resetStore: () => Promise<void>;
            };
          }
        ).__sqlHost;
        try {
          await host.open('user_poolfill0001');
          frame.remove();
          return true;
        } catch {
          // Pool exhausted — destroy iframe (releases handles), wipe, remount.
          frame.remove();
          const root = await navigator.storage.getDirectory();
          try {
            await root.removeEntry('expo-sqlite', { recursive: true });
          } catch {
            // already gone
          }
          const retry = document.createElement('iframe');
          retry.src = '/sql-workers/sql-host.html';
          document.body.appendChild(retry);
          await new Promise<void>((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
              if (event.source !== retry.contentWindow) return;
              const data = event.data as { type?: string; source?: string };
              if (data?.type === 'ready' && data.source === 'sql-host') {
                window.removeEventListener('message', onMessage);
                resolve();
              }
            };
            window.addEventListener('message', onMessage);
            retry.addEventListener('error', () =>
              reject(new Error('retry iframe load failed'))
            );
          });
          const retryHost = (
            retry.contentWindow as Window & {
              __sqlHost: { open: (n: string) => Promise<void> };
            }
          ).__sqlHost;
          await retryHost.open('user_poolfill0001');
          retry.remove();
          return true;
        }
      }
      return mountAndOpen();
    });
    expect(opened).toBe(true);
  });
});

declare global {
  interface Window {
    __sqlHost?: {
      open: (dbName: string) => Promise<void>;
      close: () => Promise<void>;
      query: (
        sql: string,
        values?: readonly unknown[]
      ) => Promise<Record<string, unknown>[]>;
      run: (
        sql: string,
        values?: readonly unknown[]
      ) => Promise<{ lastInsertRowId: number; changes: number }>;
      resetStore: () => Promise<void>;
    };
  }
}
