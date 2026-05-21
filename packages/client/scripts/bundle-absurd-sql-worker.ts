/**
 * Bundles the absurd-sql web worker into `public/` so Metro does not need
 * `import.meta.url` (classic web bundles break on it).
 */
import * as esbuild from 'esbuild';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  type Stats,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const repoRoot = join(clientRoot, '..', '..');
const entry = join(repoRoot, 'packages/sql-client/src/absurd-sql-db.worker.ts');
const outDir = join(
  clientRoot,
  'public',
  'generated',
  'sql',
  'absurd-sql-worker'
);
const workerOutfile = join(outDir, 'absurd-sql-db.worker.js');

mkdirSync(outDir, { recursive: true });

const shimDir = join(__dirname, 'shims');

function shouldRebuildWorker(): boolean {
  if (!existsSync(workerOutfile)) {
    return true;
  }
  const workerStat = statSync(workerOutfile);
  const buildInputs = [
    entry,
    join(__dirname, 'bundle-absurd-sql-worker.ts'),
    join(shimDir, 'path-shim.js'),
    join(shimDir, 'fs-shim.js'),
  ];
  return buildInputs.some(
    (inputPath) => statSync(inputPath).mtimeMs > workerStat.mtimeMs
  );
}

if (shouldRebuildWorker()) {
  await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    bundle: true,
    outfile: workerOutfile,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    logLevel: 'info',
    alias: {
      path: join(shimDir, 'path-shim.js'),
      fs: join(shimDir, 'fs-shim.js'),
    },
  });
} else {
  console.log(`Up-to-date: ${workerOutfile}`);
}

const require = createRequire(import.meta.url);
const wasmSource = require.resolve('@jlongster/sql.js/dist/sql-wasm.wasm');
const wasmDest = join(outDir, 'sql-wasm.wasm');

function needsCopy(sourcePath: string, destPath: string): boolean {
  if (!existsSync(destPath)) {
    return true;
  }
  const sourceStat: Stats = statSync(sourcePath);
  const destStat: Stats = statSync(destPath);
  return (
    sourceStat.mtimeMs > destStat.mtimeMs || sourceStat.size !== destStat.size
  );
}

if (needsCopy(wasmSource, wasmDest)) {
  copyFileSync(wasmSource, wasmDest);
  console.log(`Copied ${wasmSource} -> ${wasmDest}`);
} else {
  console.log(`Up-to-date: ${wasmDest}`);
}
