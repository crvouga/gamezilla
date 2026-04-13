/**
 * Serves the generated `patch-db-app/` folder over HTTP (default port 8765).
 * Use if `file://` blocks sql.js WASM; open http://127.0.0.1:8765
 */
import { join } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const ROOT = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  'packages',
  '@gamezilla/patch-db-app'
);

const port = Number(process.env['PATCHDB_APP_PORT'] ?? '8765');

const app = new Hono();

app.get(
  '/*',
  serveStatic({
    root: ROOT,
    rewriteRequestPath: (path) =>
      path === '/' || path === '' ? '/index.html' : path,
  })
);

app.notFound((c) => c.text('Not found', 404));

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`patch-db-app → http://127.0.0.1:${port}`);
