import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { handleApi } from './api-routes';
import type { ReportBucket } from './types';

export type { ReportBucket } from './types';

export type CreateSimulationReportServerOptions = {
  readonly buckets: readonly ReportBucket[];
  /** Prebuilt SPA dir (default: package `dist/`). */
  readonly distDir?: string;
  /** Clock for prune `olderThanMs` (inject from composition root). */
  readonly now?: () => number;
};

export type SimulationReportServer = {
  readonly fetch: (req: Request) => Promise<Response>;
};

function contentTypeForPath(path: string): string {
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

/**
 * Library entry: multi-bucket report API + SPA static files.
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

  return {
    fetch: (req) => handleFetch(req, buckets, distDir, now),
  };
}

async function handleFetch(
  req: Request,
  buckets: readonly ReportBucket[],
  distDir: string | undefined,
  now: (() => number) | undefined
): Promise<Response> {
  const url = new URL(req.url);
  const api = await handleApi(req, url, buckets, now);
  if (api) return api;

  if (distDir) {
    const staticFile = serveDist(url.pathname, distDir);
    if (staticFile) return staticFile;

    if (!url.pathname.startsWith('/api/')) {
      const index = join(distDir, 'index.html');
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
