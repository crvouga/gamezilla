// @io-wall-ok — build script entry

import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import * as esbuild from 'esbuild';

const log = createLogger({
  name: 'sql-client:build-web-workers',
  now: wallClock.now,
});

const pkgRoot = join(import.meta.dir, '..');

const sqlHostSharedOptions = (): esbuild.BuildOptions => ({
  bundle: true,
  platform: 'browser',
  target: ['es2022'],
  format: 'esm',
  logLevel: 'info',
});

/** Every `sql-workers/` directory the built assets are published into. */
export const sqlWorkerDirs = [
  join(pkgRoot, '../../apps/client/public/sql-workers'),
  join(pkgRoot, '../../apps/product/public/sql-workers'),
  join(pkgRoot, 'e2e/public/sql-workers'),
];

const dbHostSharedWorkerEntry = join(pkgRoot, 'src/db-host-shared-worker.ts');
const sqliteWorkerEntry = join(
  pkgRoot,
  'src/sqlite-worker/sqlite-worker-entry.ts'
);
const sqlHostEntry = join(pkgRoot, 'src/sql-host/sql-host-entry.ts');
const sqlHostHtml = join(pkgRoot, 'src/sql-host/sql-host.html');

const sqliteWasmSrc = import.meta.resolve(
  '@sqlite.org/sqlite-wasm/sqlite3.wasm'
);

/** Stale expo-sqlite-era artifacts the OPFS SAH-pool build no longer emits. */
const STALE_SQL_WORKER_FILES = [
  'sqlite-worker-entry.js',
  'worker',
  'worker.js',
  'wa-sqlite.wasm',
];

async function buildSharedWorker(outfile: string): Promise<void> {
  await esbuild.build({
    ...sqlHostSharedOptions(),
    entryPoints: [dbHostSharedWorkerEntry],
    outfile,
  });
  log.info(`wrote ${outfile}`);
}

/**
 * `@sqlite.org/sqlite-wasm` resolves `new URL('sqlite3.wasm', import.meta.url)`
 * at runtime, so the wasm must live beside the worker bundle.
 */
async function buildSqliteWorker(outDir: string): Promise<void> {
  await esbuild.build({
    ...sqlHostSharedOptions(),
    entryPoints: [sqliteWorkerEntry],
    outfile: join(outDir, 'sqlite-worker.js'),
  });
  const wasmOut = join(outDir, 'sqlite3.wasm');
  copyFileSync(sqliteWasmSrc.replace(/^file:\/\//, ''), wasmOut);
  log.info(`wrote ${wasmOut}`);
}

/**
 * Disposable iframe page used by e2e (and recovery remount) to own the
 * dedicated sqlite-wasm worker. Destroying the document releases OPFS handles.
 */
async function buildSqlHost(outDir: string): Promise<void> {
  await esbuild.build({
    ...sqlHostSharedOptions(),
    entryPoints: [sqlHostEntry],
    outfile: join(outDir, 'sql-host.js'),
  });
  copyFileSync(sqlHostHtml, join(outDir, 'sql-host.html'));
  log.info(`wrote ${outDir}/{sql-host.js,sql-host.html}`);
}

async function main(): Promise<void> {
  for (const outDir of sqlWorkerDirs) {
    mkdirSync(outDir, { recursive: true });
    for (const stale of STALE_SQL_WORKER_FILES) {
      rmSync(join(outDir, stale), { force: true });
    }
    await buildSharedWorker(join(outDir, 'db-host-shared-worker.js'));
    await buildSqliteWorker(outDir);
    await buildSqlHost(outDir);
    log.info(
      `wrote ${outDir}/{db-host-shared-worker.js,sqlite-worker.js,sqlite3.wasm,sql-host.js,sql-host.html}`
    );
  }
}

try {
  await main();
} finally {
  // Stop the persistent native service so it cannot outlive this script.
  await esbuild.stop();
}
