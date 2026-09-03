// @io-wall-ok — e2e static server entry

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import * as esbuild from 'esbuild';

const log = createLogger({
  name: 'sql-client:e2e-harness',
  now: wallClock.now,
});

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const outDir = join(here, 'public');
const PORT = 4177;

mkdirSync(join(outDir, 'sql-workers'), { recursive: true });

await esbuild.build({
  entryPoints: [join(pkgRoot, 'src/sqlite/web/db-host-shared-worker.ts')],
  outfile: join(outDir, 'sql-workers/db-host-shared-worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
});

await esbuild.build({
  entryPoints: [join(here, 'harness/tab-app.ts')],
  outfile: join(outDir, 'tab-app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
});

// Builds are done; stop the service so it does not outlive this long-lived server.
await esbuild.stop();

writeFileSync(
  join(outDir, 'index.html'),
  readFileSync(join(here, 'harness/index.html'), 'utf8')
);

const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
};

/**
 * expo-sqlite resolves its worker as `./worker` (no extension), so bare paths
 * under `sql-workers/` must still be served with a script content type.
 */
function contentTypeFor(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot < 0) return 'text/javascript';
  return mime[base.slice(dot)] ?? 'application/octet-stream';
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (path.includes('..')) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  try {
    const file = readFileSync(join(outDir, path));
    res.writeHead(200, {
      'content-type': contentTypeFor(path),
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  log.info(`sql-client e2e harness on http://127.0.0.1:${PORT}`);
});
