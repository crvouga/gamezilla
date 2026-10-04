import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildSqlWorkers } from '@pkgs/sql-client-sqlite-web-server/sqlite-web-assets';

// regression: flat-sqlite-worker-assets
test('flat client workers produce every asset referenced by the browser', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sqlite-web-assets-'));
  try {
    expect(
      await buildSqlWorkers({
        repoRoot: resolve(import.meta.dirname, '../../..'),
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
      expect(readFileSync(join(outDir, name), 'utf8')).not.toContain('@pkgs/');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
