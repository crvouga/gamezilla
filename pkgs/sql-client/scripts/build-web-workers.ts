// @io-wall-ok — build script entry

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const entry = join(pkgRoot, 'src/sqlite/web/db-host-shared-worker.ts');

const targets = [
  join(
    pkgRoot,
    '../../apps/client/public/sql-workers/db-host-shared-worker.js'
  ),
  join(pkgRoot, 'e2e/public/sql-workers/db-host-shared-worker.js'),
];

async function main(): Promise<void> {
  for (const outfile of targets) {
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
}

await main();
