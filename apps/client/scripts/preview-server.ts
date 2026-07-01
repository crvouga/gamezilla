/**
 * Serves the Expo web export on :5173 and proxies `/api/*` (including
 * `/api/room` WebSocket) to wrangler so Better Auth cookies, PatchDB sync,
 * and space rooms stay first-party.
 */
import { assert } from '@pkgs/assert';
import { join } from 'node:path';
import { file } from 'bun';

import { startWebDevProxyServer } from './local-api-proxy';
import { applyExpoSqliteWebIsolationHeadersToFetch } from './expo-sqlite-web-headers.js';
import { previewStackReadyResponse } from './preview-stack-ready';

const DIST_DIR = join(import.meta.dir, '..', 'dist');
const INDEX_HTML = join(DIST_DIR, 'index.html');

const portRaw = process.env['PREVIEW_PORT'] ?? '5173';
const port = Number(portRaw);
assert.ok(
  Number.isInteger(port) && port > 0,
  `invalid PREVIEW_PORT: ${portRaw}`
);

const indexFile = file(INDEX_HTML);
assert.ok(
  indexFile.size > 0,
  'dist/index.html must exist — run `bun run --filter @apps/client build` first',
  { path: INDEX_HTML }
);

function resolveStaticPath(pathname: string): string {
  const safe = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (safe.length === 0) return INDEX_HTML;
  return join(DIST_DIR, safe);
}

async function serveStatic(pathname: string): Promise<Response> {
  if (pathname === '/ready') {
    return previewStackReadyResponse();
  }
  const diskPath = resolveStaticPath(pathname);
  const candidate = file(diskPath);
  const body = (await candidate.exists()) ? candidate : indexFile;
  const headers = new Headers();
  applyExpoSqliteWebIsolationHeadersToFetch(headers);
  return new Response(body, { headers });
}

startWebDevProxyServer({
  port,
  webTarget: '',
  serveWeb: serveStatic,
  logLabel: 'preview-server',
});
