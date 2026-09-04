// @io-wall-ok — build script entry

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import * as esbuild from 'esbuild';
import {
  expoSqliteWorkerEntry,
  pkgRoot,
  SQL_WORKERS_PUBLIC_PATH,
  sqlHostEntry,
  sqlHostHtml,
  sqlHostSharedOptions,
} from './sql-host-build';

const log = createLogger({
  name: 'sql-client:build-web-workers',
  now: wallClock.now,
});

const entry = join(pkgRoot, 'src/db-host-shared-worker.ts');

/** Every `sql-workers/` directory the built assets are published into. */
export const sqlWorkerDirs = [
  join(pkgRoot, '../../apps/client/public/sql-workers'),
  join(pkgRoot, 'e2e/public/sql-workers'),
];

const workerTargets = sqlWorkerDirs.map((dir) =>
  join(dir, 'db-host-shared-worker.js')
);

const staticTargets = [{ from: sqlHostHtml, name: 'sql-host.html' }];

/**
 * expo-sqlite's web module hard-codes `new Worker(new URL('./worker', href))`,
 * so the classic worker bundle must land at `<dir>/worker` (extensionless).
 * The `.wasm` file loader also emits `wa-sqlite.wasm` into the same directory.
 */
async function buildExpoSqliteWorker(outDir: string): Promise<void> {
  await esbuild.build({
    ...sqlHostSharedOptions(),
    entryPoints: [{ in: expoSqliteWorkerEntry, out: 'worker' }],
    outdir: outDir,
    format: 'iife',
    loader: { '.wasm': 'file' },
    assetNames: '[name]',
    publicPath: SQL_WORKERS_PUBLIC_PATH,
  });
  copyFileSync(join(outDir, 'worker.js'), join(outDir, 'worker'));
}

async function buildSqlHost(outDir: string): Promise<void> {
  await esbuild.build({
    ...sqlHostSharedOptions(),
    entryPoints: [sqlHostEntry],
    outfile: join(outDir, 'sql-host.js'),
    format: 'esm',
  });
}

async function main(): Promise<void> {
  for (const outfile of workerTargets) {
    mkdirSync(dirname(outfile), { recursive: true });
    await esbuild.build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      logLevel: 'info',
    });
    log.info(`wrote ${outfile}`);
  }
  for (const outDir of sqlWorkerDirs) {
    mkdirSync(outDir, { recursive: true });
    await buildSqlHost(outDir);
    await buildExpoSqliteWorker(outDir);
    log.info(`wrote ${outDir}/{sql-host.js,worker,worker.js,wa-sqlite.wasm}`);
  }
  for (const { from, name } of staticTargets) {
    for (const outDir of sqlWorkerDirs) {
      const outfile = join(outDir, name);
      mkdirSync(outDir, { recursive: true });
      copyFileSync(from, outfile);
      log.info(`wrote ${outfile}`);
    }
  }
}

try {
  await main();
} finally {
  // Stop the persistent native service so it cannot outlive this script.
  await esbuild.stop();
}
