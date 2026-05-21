/**
 * Serves the `packages/patch-db-example` folder over HTTP (default port 8765).
 * Use if `file://` blocks sql.js WASM; open http://127.0.0.1:8765
 */
import { createLogger } from '@gamezilla/logger';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { join } from 'node:path';

const log = createLogger({ name: 'patch-db:app' });

const ROOT = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'patch-db-example'
);

const port = Number(process.env['PATCHDB_APP_PORT'] ?? '8765');

const app = new Hono()
  .get(
    '/*',
    serveStatic({
      root: ROOT,
      rewriteRequestPath: (path) =>
        path === '/' || path === '' ? '/index.html' : path,
    })
  )
  .notFound((c) => c.text('Not found', 404));

Bun.serve({
  port,
  fetch: app.fetch,
});

log.info('server started', { url: `http://127.0.0.1:${port}` });
