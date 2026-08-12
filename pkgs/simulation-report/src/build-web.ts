import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// @io-wall-ok — package build script entry.

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, 'web');
const distDir = join(here, '..', 'dist');

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
