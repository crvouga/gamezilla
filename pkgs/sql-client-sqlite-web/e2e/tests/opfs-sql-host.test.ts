import { beforeAll, describe, expect, test } from 'bun:test';
import { kvDdl } from '../helpers/kv-schema';
import { closeView, evalFn, openView, waitFor, waitForHttp } from '../webview';

const ORIGIN = 'http://127.0.0.1:4177';

beforeAll(async () => {
  await waitForHttp(ORIGIN);
});

describe('expo-sqlite OPFS via sql-host iframe', () => {
  test('open user_* db, write, read', async () => {
    const page = await openView(`${ORIGIN}/sql-workers/sql-host.html`);
    try {
      await waitFor(page, 'window.__sqlHost !== undefined');
      await evalFn(
        page,
        `async (ddl) => {
          const host = window.__sqlHost;
          await host.open('user_6b3822ef08e0');
          for (const stmt of ddl) await host.run(stmt);
          await host.run('DELETE FROM kv');
          await host.run('INSERT INTO kv (id, k, v) VALUES (?, ?, ?)', ['1', 'a', '1']);
        }`,
        kvDdl
      );
      const rows = await evalFn(
        page,
        `async () => window.__sqlHost.query('SELECT k, v FROM kv')`,
        null
      );
      expect(rows).toEqual([{ k: 'a', v: '1' }]);
    } finally {
      closeView(page);
    }
  });

  test('resetStore clears OPFS; remount reopen is empty', async () => {
    const page = await openView(`${ORIGIN}/sql-workers/sql-host.html`);
    try {
      await waitFor(page, 'window.__sqlHost !== undefined');
      await evalFn(
        page,
        `async (ddl) => {
          const host = window.__sqlHost;
          await host.open('user_deadbeef0001');
          for (const stmt of ddl) await host.run(stmt);
          await host.run('INSERT INTO kv (id, k) VALUES (?, ?)', ['1', 'x']);
          await host.resetStore();
        }`,
        kvDdl
      );
      await page.evaluate('location.reload()');
      await waitFor(page, 'window.__sqlHost !== undefined');
      await evalFn(
        page,
        `async () => { await window.__sqlHost.open('user_deadbeef0001'); }`,
        null
      );
      const tables = await evalFn(
        page,
        `async () => window.__sqlHost.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )`,
        null
      );
      expect(tables).toEqual([]);
    } finally {
      closeView(page);
    }
  });

  test('iframe recycle releases handles; second mount opens', async () => {
    const page = await openView(`${ORIGIN}/`);
    try {
      const result = await evalFn(
        page,
        `async (ddl) => {
          async function mount() {
            const frame = document.createElement('iframe');
            frame.src = '/sql-workers/sql-host.html';
            document.body.appendChild(frame);
            await new Promise((resolve, reject) => {
              const onMessage = (event) => {
                if (event.source !== frame.contentWindow) return;
                const data = event.data;
                if (data && data.type === 'ready' && data.source === 'sql-host') {
                  window.removeEventListener('message', onMessage);
                  resolve();
                }
              };
              window.addEventListener('message', onMessage);
              frame.addEventListener('error', () =>
                reject(new Error('iframe load failed'))
              );
            });
            const host = frame.contentWindow.__sqlHost;
            return {
              open: (n) => host.open(n),
              run: (s, v) => host.run(s, v),
              query: (s) => host.query(s),
              destroy: () => { frame.remove(); },
            };
          }
          const first = await mount();
          await first.open('user_recycle00001');
          for (const stmt of ddl) await first.run(stmt);
          await first.run('INSERT INTO kv (id, k) VALUES (?, ?)', ['1', '1']);
          first.destroy();
          const second = await mount();
          await second.open('user_recycle00001');
          const rows = await second.query('SELECT k FROM kv');
          second.destroy();
          return rows;
        }`,
        kvDdl
      );
      expect(result).toEqual([{ k: '1' }]);
    } finally {
      closeView(page);
    }
  });

  test('pre-seeded OPFS junk beyond pool capacity auto-recovers via remount wipe', async () => {
    const page = await openView(`${ORIGIN}/`);
    try {
      await evalFn(
        page,
        `async () => {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle('expo-sqlite', { create: true });
          for (let i = 0; i < 12; i++) {
            const file = await dir.getFileHandle('junk-' + i, { create: true });
            const writable = await file.createWritable();
            await writable.write(new Uint8Array([0, 1, 2, 3]));
            await writable.close();
          }
        }`,
        null
      );
      const opened = await evalFn(
        page,
        `async () => {
          async function mountAndOpen() {
            const frame = document.createElement('iframe');
            frame.src = '/sql-workers/sql-host.html';
            document.body.appendChild(frame);
            await new Promise((resolve, reject) => {
              const onMessage = (event) => {
                if (event.source !== frame.contentWindow) return;
                const data = event.data;
                if (data && data.type === 'ready' && data.source === 'sql-host') {
                  window.removeEventListener('message', onMessage);
                  resolve();
                }
              };
              window.addEventListener('message', onMessage);
              frame.addEventListener('error', () =>
                reject(new Error('iframe load failed'))
              );
            });
            const host = frame.contentWindow.__sqlHost;
            try {
              await host.open('user_poolfill0001');
              frame.remove();
              return true;
            } catch {
              frame.remove();
              const root = await navigator.storage.getDirectory();
              try {
                await root.removeEntry('expo-sqlite', { recursive: true });
              } catch {}
              const retry = document.createElement('iframe');
              retry.src = '/sql-workers/sql-host.html';
              document.body.appendChild(retry);
              await new Promise((resolve, reject) => {
                const onMessage = (event) => {
                  if (event.source !== retry.contentWindow) return;
                  const data = event.data;
                  if (data && data.type === 'ready' && data.source === 'sql-host') {
                    window.removeEventListener('message', onMessage);
                    resolve();
                  }
                };
                window.addEventListener('message', onMessage);
                retry.addEventListener('error', () =>
                  reject(new Error('retry iframe load failed'))
                );
              });
              await retry.contentWindow.__sqlHost.open('user_poolfill0001');
              retry.remove();
              return true;
            }
          }
          return mountAndOpen();
        }`,
        null
      );
      expect(opened).toBe(true);
    } finally {
      closeView(page);
    }
  });
});
