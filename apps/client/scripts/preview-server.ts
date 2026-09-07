/**
 * Serves the production web build on `PREVIEW_PORT` (default :5173).
 * API traffic uses `VITE_API_URL` (wrangler on :8788) with Bearer auth.
 */

import { join } from 'node:path';
import { assert } from '@pkgs/assert';
import { file } from 'bun';

import { previewStackReadyResponse } from './preview-stack-ready';
import { applySqliteWebIsolationHeadersToFetch } from './sqlite-web-headers.js';

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
  applySqliteWebIsolationHeadersToFetch(headers);
  return new Response(body, { headers });
}

const server = Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    return serveStatic(url.pathname);
  },
});

process.stdout.write(`[preview-server] static web=${server.url.origin}\n`);
