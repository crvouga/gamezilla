import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Timers } from '@pkgs/clock';

import { handleApi } from './api-routes';
import { type BucketWatcher, startBucketWatcher } from './bucket-watcher';
import { SseHub } from './sse-hub';
import type { ReportBucket } from './types';

export type { ReportBucket } from './types';

export type CreateSimulationReportServerOptions = {
  readonly buckets: readonly ReportBucket[];
  /** Injected timers for SSE heartbeat + bucket watch debounce/poll. */
  readonly timers: Timers;
  /** Prebuilt SPA dir (default: package `dist/`). */
  readonly distDir?: string;
  /** Clock for prune `olderThanMs` (inject from composition root). */
  readonly now?: () => number;
};

export type SimulationReportServer = {
  readonly fetch: (req: Request) => Promise<Response>;
  readonly stop: () => void;
};

function contentTypeForPath(path: string): string {
  if (path.endsWith('.js') || path.endsWith('.mjs')) {
    return 'application/javascript; charset=utf-8';
  }
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.wasm')) return 'application/wasm';
  return 'application/octet-stream';
}

/**
 * Library entry: multi-bucket report API + SPA static files + SSE watchers.
 */
export function createSimulationReportServer(
  options: CreateSimulationReportServerOptions
): SimulationReportServer {
  const buckets = options.buckets;
  if (buckets.length === 0) {
    throw new Error('createSimulationReportServer: buckets must be non-empty');
  }
  const ids = new Set(buckets.map((b) => b.id));
  if (ids.size !== buckets.length) {
    throw new Error('createSimulationReportServer: bucket ids must be unique');
  }

  const distDir = options.distDir;
  const now = options.now;
  const timers = options.timers;
  const hub = new SseHub();
  const watchers = new Map<string, BucketWatcher>();
  for (const bucket of buckets) {
    watchers.set(bucket.id, startBucketWatcher(bucket, hub, timers));
  }

  return {
    fetch: (req) =>
      handleFetch(req, {
        buckets,
        hub,
        watchers,
        distDir,
        now,
        timers,
      }),
    stop: () => {
      for (const w of watchers.values()) w.stop();
      watchers.clear();
    },
  };
}

async function handleFetch(
  req: Request,
  ctx: {
    readonly buckets: readonly ReportBucket[];
    readonly hub: SseHub;
    readonly watchers: ReadonlyMap<string, BucketWatcher>;
    readonly distDir: string | undefined;
    readonly now: (() => number) | undefined;
    readonly timers: Timers;
  }
): Promise<Response> {
  const url = new URL(req.url);
  const api = await handleApi(req, url, {
    buckets: ctx.buckets,
    hub: ctx.hub,
    watchers: ctx.watchers,
    now: ctx.now,
    timers: ctx.timers,
  });
  if (api) return api;

  if (ctx.distDir) {
    const staticFile = serveDist(url.pathname, ctx.distDir);
    if (staticFile) return staticFile;

    if (!url.pathname.startsWith('/api/')) {
      const index = join(ctx.distDir, 'index.html');
      if (existsSync(index)) {
        return new Response(Bun.file(index), {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }
    }
  }

  return new Response('Not found', { status: 404 });
}

function serveDist(pathname: string, distDir: string): Response | null {
  const rel =
    pathname === '/' || pathname === ''
      ? 'index.html'
      : pathname.replace(/^\//, '');
  if (rel.includes('..') || rel.includes('\0')) return null;
  const filePath = join(distDir, rel);
  if (!existsSync(filePath)) return null;
  return new Response(Bun.file(filePath), {
    headers: {
      'content-type': contentTypeForPath(filePath),
      'cache-control': pathname.startsWith('/app.') ? 'no-cache' : 'no-store',
    },
  });
}
