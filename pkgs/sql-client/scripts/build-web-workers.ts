// @io-wall-ok — build script entry

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const entry = join(pkgRoot, 'src/sqlite/web/db-host-shared-worker.ts');
const wipeHtml = join(pkgRoot, 'src/sqlite/web/opfs-wipe.html');
const wipeBoot = join(pkgRoot, 'src/sqlite/web/opfs-wipe-boot.js');
const wipeEntry = join(pkgRoot, 'src/sqlite/web/opfs-wipe-entry.js');

const workerTargets = [
  join(
    pkgRoot,
    '../../apps/client/public/sql-workers/db-host-shared-worker.js'
  ),
  join(pkgRoot, 'e2e/public/sql-workers/db-host-shared-worker.js'),
];

const staticTargets = [
  {
    from: wipeHtml,
    to: [
      join(pkgRoot, '../../apps/client/public/sql-workers/opfs-wipe.html'),
      join(pkgRoot, 'e2e/public/sql-workers/opfs-wipe.html'),
    ],
  },
  {
    from: wipeBoot,
    to: [
      join(pkgRoot, '../../apps/client/public/sql-workers/opfs-wipe-boot.js'),
      join(pkgRoot, 'e2e/public/sql-workers/opfs-wipe-boot.js'),
    ],
  },
  {
    from: wipeEntry,
    to: [
      join(pkgRoot, '../../apps/client/public/sql-workers/opfs-wipe-entry.js'),
      join(pkgRoot, 'e2e/public/sql-workers/opfs-wipe-entry.js'),
    ],
  },
];

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
    console.log(`wrote ${outfile}`);
  }
  for (const { from, to } of staticTargets) {
    for (const outfile of to) {
      mkdirSync(dirname(outfile), { recursive: true });
      copyFileSync(from, outfile);
      console.log(`wrote ${outfile}`);
    }
  }
}

try {
  await main();
} finally {
  // Stop the persistent native service so it cannot outlive this script.
  await esbuild.stop();
}
