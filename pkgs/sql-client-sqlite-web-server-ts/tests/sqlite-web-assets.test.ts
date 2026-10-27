import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, win32 } from 'node:path';
import {
  buildSqlWorkers,
  sqliteWebAssets,
} from '@pkgs/sql-client-sqlite-web-server-ts/sqlite-web-assets';
import { createServer, type UserConfig } from 'vite';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

// regression: flat-sqlite-worker-assets
test('flat client workers produce every asset referenced by the browser', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sqlite-web-assets-'));
  try {
    expect(
      await buildSqlWorkers({
        repoRoot: REPO_ROOT,
        outDir,
        force: true,
      })
    ).toBe(5);
    expect(readdirSync(outDir).sort()).toEqual([
      'db-host-shared-worker.js',
      'sql-host.html',
      'sql-host.js',
      'sqlite-worker.js',
      'sqlite3.wasm',
    ]);
    expect(readFileSync(join(outDir, 'sql-host.html'), 'utf8')).toContain(
      './sql-host.js'
    );
    for (const name of [
      'db-host-shared-worker.js',
      'sql-host.js',
      'sqlite-worker.js',
    ])
      expect(readFileSync(join(outDir, name), 'utf8')).not.toMatch(
        /(?:from\s*|import\s*\(?)['"]@pkgs\//
      );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// regression: dev-sqlite-workers-served-as-html
test('a first dev start in a fresh checkout serves the workers it just emitted', async () => {
  // An app whose `public/` holds no SQLite asset yet, as in a new worktree.
  const root = mkdtempSync(join(tmpdir(), 'sqlite-web-dev-'));
  const publicDir = join(root, 'public');
  mkdirSync(publicDir);
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>app</title>');
  const server = await createServer({
    root,
    publicDir,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [
      sqliteWebAssets({
        repoRoot: REPO_ROOT,
        sqlWorkersDir: join(publicDir, 'sql-workers'),
        sqliteWasmDir: join(publicDir, 'generated/sqlite-wasm'),
      }),
    ],
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    // The dev server answers an unknown path with `index.html`, and a worker
    // handed HTML never starts: the app then runs without its real database.
    for (const path of [
      '/sql-workers/db-host-shared-worker.js',
      '/sql-workers/sqlite-worker.js',
      '/sql-workers/sqlite3.wasm',
      '/generated/sqlite-wasm/index.mjs',
    ]) {
      const response = await fetch(`http://127.0.0.1:${String(port)}${path}`);
      const served = `${path} ${response.headers.get('content-type') ?? ''}`;
      await response.arrayBuffer();
      expect(served).not.toContain('text/html');
      expect(served).toMatch(/javascript|wasm/);
    }
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: sqlite-watch-ignore-windows-glob
test('the dev server ignores the emitted Windows directories', () => {
  const publicDir = win32.join('C:\\app', 'public');
  const plugin = sqliteWebAssets({
    repoRoot: 'C:\\repo',
    sqlWorkersDir: win32.join(publicDir, 'sql-workers'),
    sqliteWasmDir: win32.join(publicDir, 'generated', 'sqlite-wasm'),
  });
  const config = (plugin.config as () => UserConfig)();
  expect(config.server?.watch?.ignored).toEqual([
    'C:/app/public/sql-workers/**',
    'C:/app/public/generated/sqlite-wasm/**',
  ]);
});
