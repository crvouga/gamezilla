// @io-wall-ok — package build script entry.

import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, 'web');
const distDir = join(here, '..', 'dist');
const pkgRoot = join(here, '..');

await mkdir(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(webDir, 'index.html')],
  target: 'browser',
  minify: true,
  outdir: distDir,
});

if (!result.success) {
  console.error(result.logs);
  throw new Error('system-console web build failed');
}

await copySqliteWasmAssets(distDir, pkgRoot);

process.stdout.write(`Built system-console SPA → ${distDir}\n`);

async function copySqliteWasmAssets(
  outDir: string,
  packageRoot: string
): Promise<void> {
  const resolved = Bun.resolveSync('@sqlite.org/sqlite-wasm', packageRoot);
  // resolved → …/dist/index.mjs; wasm must sit next to bundled app.js because
  // the module loads via `new URL("sqlite3.wasm", import.meta.url)`.
  const wasmDist = dirname(resolved);
  await cp(join(wasmDist, 'sqlite3.wasm'), join(outDir, 'sqlite3.wasm'));
  // Also keep worker helpers under /sqlite-wasm/ for optional worker use.
  const helperDir = join(outDir, 'sqlite-wasm');
  await mkdir(helperDir, { recursive: true });
  for (const name of [
    'sqlite3.wasm',
    'sqlite3-worker1.mjs',
    'sqlite3-opfs-async-proxy.js',
  ]) {
    await cp(join(wasmDist, name), join(helperDir, name));
  }
}
