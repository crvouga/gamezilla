/**
 * Serves the production web build on `PREVIEW_PORT` (default :5173).
 * When `LOCAL_PREVIEW_API_ORIGIN` is set, proxies `/api/*` to that origin so a
 * production-shaped bundle can talk same-origin (Lighthouse / local preview).
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

const apiProxyOrigin = (process.env['LOCAL_PREVIEW_API_ORIGIN'] ?? '').trim();

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

function withIsolation(res: Response): Response {
  const headers = new Headers(res.headers);
  applySqliteWebIsolationHeadersToFetch(headers);
  return new Response(res.body, { status: res.status, headers });
}

async function proxyApi(req: Request): Promise<Response> {
  assert.ok(apiProxyOrigin.length > 0, 'LOCAL_PREVIEW_API_ORIGIN required');
  const inbound = new URL(req.url);
  const base = apiProxyOrigin.endsWith('/')
    ? apiProxyOrigin
    : `${apiProxyOrigin}/`;
  const target = new URL(`${inbound.pathname}${inbound.search}`, base);
  const method = req.method;
  const upstream = await fetch(target, {
    method,
    headers: req.headers,
    body:
      method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
        ? undefined
        : await req.arrayBuffer(),
    redirect: 'manual',
  });
  return withIsolation(
    new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    })
  );
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
    if (apiProxyOrigin.length > 0 && url.pathname.startsWith('/api/')) {
      return proxyApi(req);
    }
    return serveStatic(url.pathname);
  },
});

process.stdout.write(
  `[preview-server] static web=${server.url.origin}` +
    (apiProxyOrigin.length > 0 ? ` api-proxy=${apiProxyOrigin}\n` : '\n')
);
