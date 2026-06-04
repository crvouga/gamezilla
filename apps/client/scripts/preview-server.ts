/**
 * Serves the Expo web export on :5173 and proxies `/api/*` to the local API
 * worker so Better Auth session cookies stay first-party (cross-port requests
 * from the static preview to :8788 do not persist session cookies in Chromium).
 */
import { assert } from '@pkgs/assert';
import { join } from 'node:path';
import { file } from 'bun';

const DIST_DIR = join(import.meta.dir, '..', 'dist');
const INDEX_HTML = join(DIST_DIR, 'index.html');

const portRaw = process.env['PREVIEW_PORT'] ?? '5173';
const port = Number(portRaw);
assert.ok(
  Number.isInteger(port) && port > 0,
  `invalid PREVIEW_PORT: ${portRaw}`
);

const proxyTargetRaw =
  process.env['LOCAL_PREVIEW_API_PROXY_TARGET'] ?? 'http://127.0.0.1:8788';
let proxyTarget = '';
assert.notThrows(
  () => {
    proxyTarget = new URL(proxyTargetRaw).origin;
  },
  'LOCAL_PREVIEW_API_PROXY_TARGET must parse as a URL',
  { proxyTargetRaw }
);
assert.nonEmptyString(proxyTarget, 'proxy target origin must be non-empty');

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
  const diskPath = resolveStaticPath(pathname);
  const candidate = file(diskPath);
  if (await candidate.exists()) {
    return new Response(candidate);
  }
  return new Response(indexFile);
}

async function proxyApi(req: Request, url: URL): Promise<Response> {
  const upstream = new URL(`${url.pathname}${url.search}`, proxyTarget);
  assert.ok(
    upstream.pathname.startsWith('/api/'),
    `proxy only handles /api/*, got: ${upstream.pathname}`
  );
  const headers = new Headers(req.headers);
  headers.set('host', upstream.host);
  return fetch(upstream, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    redirect: 'manual',
  });
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return proxyApi(req, url);
    }
    return serveStatic(url.pathname);
  },
});

process.stdout.write(
  `[preview-server] web=${server.url.origin} api-proxy=${proxyTarget}\n`
);
