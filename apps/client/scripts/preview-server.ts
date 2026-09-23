/**
 * Serves the production web build on `PREVIEW_PORT` (default :5173).
 * If that port is taken, binds an ephemeral port instead (parallel CI safe).
 * When `LOCAL_PREVIEW_API_ORIGIN` is set, proxies `/api/*` to that origin so a
 * production-shaped bundle can talk same-origin (Lighthouse / local preview).
 */

import { assert } from '@pkgs/assert';

import { startPreviewWebServer } from './preview-web-server';

const portRaw = process.env['PREVIEW_PORT'] ?? '5173';
const preferredPort = Number(portRaw);
assert.ok(
  Number.isInteger(preferredPort) && preferredPort >= 0,
  `invalid PREVIEW_PORT: ${portRaw}`
);

const apiProxyOrigin = (process.env['LOCAL_PREVIEW_API_ORIGIN'] ?? '').trim();

const server = startPreviewWebServer({ port: preferredPort, apiProxyOrigin });
if (preferredPort > 0 && server.port !== preferredPort) {
  process.stderr.write(
    `[preview-server] preferred :${String(preferredPort)} busy; using :${String(server.port)}\n`
  );
}

process.stdout.write(
  `[preview-server] static web=${server.url.origin}` +
    (apiProxyOrigin.length > 0 ? ` api-proxy=${apiProxyOrigin}\n` : '\n')
);
