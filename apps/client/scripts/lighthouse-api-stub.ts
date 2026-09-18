#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Tiny API stub so the client shell can boot during Lighthouse CI
 * without wrangler / Postgres. Tracks response body bytes for first-load budget.
 *
 * Prefer same-origin via preview-server `/api` proxy (`LOCAL_PREVIEW_API_ORIGIN`).
 * CORS + CORP remain for direct cross-origin probes.
 */
import { listenPreferredOrEphemeral } from './listen-preferred-or-ephemeral';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
  'cross-origin-resource-policy': 'cross-origin',
};

export function startPerfApiStub(preferredPort = 8799): {
  stop: () => void;
  origin: string;
  port: number;
  totalResponseBytes: () => number;
} {
  let totalResponseBytes = 0;
  const track = (body: string, init?: ResponseInit): Response => {
    totalResponseBytes += Buffer.byteLength(body);
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      headers.set(k, v);
    }
    return new Response(body, { ...init, headers });
  };
  const { server, port } = listenPreferredOrEphemeral({
    preferredPort,
    fetch(req) {
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      const path = new URL(req.url).pathname;
      if (path === '/api/health' || path.endsWith('/api/health')) {
        // Match production `/api/health` (`{ status: 'ok' }`) for
        // `probeHealthEndpoint`.
        return track(JSON.stringify({ status: 'ok' }));
      }
      if (path.includes('/api/identity/')) {
        return track(
          JSON.stringify({
            token: 'perf-stub-token',
            accountId: 'perf-stub-account',
          })
        );
      }
      if (path.includes('/api/query')) {
        return track(JSON.stringify({ responses: [] }));
      }
      if (path.includes('/api/mutations')) {
        return track(JSON.stringify({ results: [] }));
      }
      return new Response('not found', {
        status: 404,
        headers: CORS_HEADERS,
      });
    },
  });
  if (port !== preferredPort) {
    console.log(
      `[lighthouse] API stub preferred :${String(preferredPort)} busy; using :${String(port)}`
    );
  }
  return {
    origin: server.url.origin,
    port,
    totalResponseBytes: () => totalResponseBytes,
    stop: () => {
      server.stop(true);
    },
  };
}
