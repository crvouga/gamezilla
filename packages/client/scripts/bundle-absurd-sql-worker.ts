/**
 * Bundles the absurd-sql web worker into `public/` so Metro does not need
 * `import.meta.url` (classic web bundles break on it).
 */
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const repoRoot = join(clientRoot, '..', '..');
const entry = join(
  repoRoot,
  'packages/lib/src/sql-client/absurd-sql-db.worker.ts'
);
const outDir = join(clientRoot, 'public', 'absurd-sql-worker');

mkdirSync(outDir, { recursive: true });

const shimDir = join(__dirname, 'shims');

await esbuild.build({
  absWorkingDir: repoRoot,
  entryPoints: [entry],
  bundle: true,
  outfile: join(outDir, 'absurd-sql-db.worker.js'),
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  logLevel: 'info',
  alias: {
    path: join(shimDir, 'path-shim.js'),
    fs: join(shimDir, 'fs-shim.js'),
  },
});

const require = createRequire(import.meta.url);
const wasmSource = require.resolve('@jlongster/sql.js/dist/sql-wasm.wasm');
copyFileSync(wasmSource, join(outDir, 'sql-wasm.wasm'));
