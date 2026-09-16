// @io-wall-ok — build script entry
/**
 * Emits the e2e harness copy of the `sql-workers/` assets. The apps get theirs
 * from the `sqliteWebAssets` Vite plugin (see `sqlite-web-assets.ts`); the e2e
 * harness serves `e2e/public` itself, so it needs this CLI.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { buildSqlWorkers } from './sqlite-web-assets';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(pkgRoot, 'e2e/public/sql-workers');

try {
  const written = await buildSqlWorkers({
    repoRoot: join(pkgRoot, '../..'),
    outDir,
    force: true,
  });
  process.stdout.write(`[sql-workers] wrote ${written} files to ${outDir}\n`);
} finally {
  // Stop the persistent native service so it cannot outlive this script.
  await esbuild.stop();
}
