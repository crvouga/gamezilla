import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// @io-wall-ok — package build script entry.

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, 'web');
const distDir = join(here, '..', 'dist');
const pkgRoot = join(here, '..');

await mkdir(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(webDir, 'main.tsx')],
  target: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: 'none',
  outdir: distDir,
  naming: 'app.js',
});

if (!result.success) {
  console.error(result.logs);
  throw new Error('simulation-report web build failed');
}

await copySqliteWasmAssets(distDir, pkgRoot);

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Simulation report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>
`;

await writeFile(join(distDir, 'index.html'), indexHtml, 'utf8');
process.stdout.write(`Built simulation-report SPA → ${distDir}\n`);

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
