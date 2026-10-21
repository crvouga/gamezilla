import { expect, test } from 'bun:test';
import { DEFAULT_SQLITE_WORKER_URL } from '@pkgs/sql-client-sqlite-web-client-ts/spawn-sqlite-worker';
import { SQLITE_WORKER_URL_PARAMS } from '@pkgs/sql-client-sqlite-web-server-ts/worker-url-params';

// regression: sqlite-opfs-vfs-proxy-served-as-html
test('the worker is spawned with the switches that keep sqlite-wasm off its OPFS VFSes', () => {
  const url = new URL(DEFAULT_SQLITE_WORKER_URL, 'https://app.example');
  expect(url.pathname).toBe('/sql-workers/sqlite-worker.js');
  // sqlite-wasm reads `<vfs>-disable` off the worker's own URL.
  expect([...url.searchParams.keys()].sort()).toEqual([
    'opfs-disable',
    'opfs-wl-disable',
  ]);
});

test('a service worker drops those switches before matching its precache', () => {
  const url = new URL(DEFAULT_SQLITE_WORKER_URL, 'https://app.example');
  for (const name of url.searchParams.keys()) {
    expect(SQLITE_WORKER_URL_PARAMS.test(name)).toBe(true);
  }
  expect(SQLITE_WORKER_URL_PARAMS.test('v')).toBe(false);
});
