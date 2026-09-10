#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Tiny API stub so the client shell can boot during Lighthouse CI
 * without wrangler / Postgres. Tracks response body bytes for first-load budget.
 */
export function startPerfApiStub(port: number): {
  stop: () => void;
  origin: string;
  totalResponseBytes: () => number;
} {
  let totalResponseBytes = 0;
  const track = (body: string): Response => {
    totalResponseBytes += Buffer.byteLength(body);
    return new Response(body, {
      headers: { 'content-type': 'application/json' },
    });
  };
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      if (path === '/api/health' || path.endsWith('/api/health')) {
        return track(JSON.stringify({ ok: true }));
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
      return new Response('not found', { status: 404 });
    },
  });
  return {
    origin: server.url.origin,
    totalResponseBytes: () => totalResponseBytes,
    stop: () => {
      server.stop(true);
    },
  };
}
