/**
 * Serves the production web build on `PREVIEW_PORT` (default :5173).
 * If that port is taken, binds an ephemeral port instead (parallel CI safe).
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
const preferredPort = Number(portRaw);
assert.ok(
  Number.isInteger(preferredPort) && preferredPort >= 0,
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

function isAddrInUse(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'EADDRINUSE'
  );
}

function startStaticServer(preferred: number): ReturnType<typeof Bun.serve> {
  const fetchHandler = (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    return serveStatic(url.pathname);
  };
  try {
    return Bun.serve({ port: preferred, fetch: fetchHandler });
  } catch (err) {
    if (!isAddrInUse(err) || preferred === 0) throw err;
    return Bun.serve({ port: 0, fetch: fetchHandler });
  }
}

const server = startStaticServer(preferredPort);
if (preferredPort > 0 && server.port !== preferredPort) {
  process.stderr.write(
    `[preview-server] preferred :${String(preferredPort)} busy; using :${String(server.port)}\n`
  );
}

process.stdout.write(`[preview-server] static web=${server.url.origin}\n`);
