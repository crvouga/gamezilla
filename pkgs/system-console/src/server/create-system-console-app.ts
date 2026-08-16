import type { Timers } from '@pkgs/clock';
import { Hono } from 'hono';

import { type HandleApiContext, handleApi } from './api-routes';
import { type BucketWatcher, startBucketWatcher } from './bucket-watcher';
import { SseHub } from './sse-hub';
import type { ReportBucket } from './types';

export type CreateSystemConsoleAppOptions = {
  readonly buckets: readonly ReportBucket[];
  readonly timers: Timers;
  /** Clock for prune `olderThanMs` (inject from composition root). */
  readonly now?: () => number;
};

export type SystemConsoleAppHandle = {
  readonly app: Hono;
  readonly stop: () => void;
};

/**
 * Library Hono app for simulation report buckets (SSE + REST).
 * Mount under `/system-console` (or any prefix); routes are `/api/*`.
 */
export function createSystemConsoleApp(
  options: CreateSystemConsoleAppOptions
): SystemConsoleAppHandle {
  const buckets = options.buckets;
  if (buckets.length === 0) {
    throw new Error('createSystemConsoleApp: buckets must be non-empty');
  }
  const ids = new Set(buckets.map((b) => b.id));
  if (ids.size !== buckets.length) {
    throw new Error('createSystemConsoleApp: bucket ids must be unique');
  }

  const hub = new SseHub();
  const watchers = new Map<string, BucketWatcher>();
  for (const bucket of buckets) {
    watchers.set(bucket.id, startBucketWatcher(bucket, hub, options.timers));
  }

  const ctx: HandleApiContext = {
    buckets,
    hub,
    watchers,
    now: options.now,
    timers: options.timers,
  };

  const app = new Hono();
  app.all('*', async (c) => {
    const url = new URL(c.req.url);
    // Hono keeps the full request path on `c.req.path` even when mounted via
    // `.route('/system-console', app)`. Route matching expects `/api/*`, so
    // slice from the `/api` segment (works at root or under any mount prefix).
    const fullPath = c.req.path;
    const apiIdx = fullPath.indexOf('/api');
    url.pathname = apiIdx >= 0 ? fullPath.slice(apiIdx) : fullPath;
    const res = await handleApi(c.req.raw, url, ctx);
    if (res) return res;
    return c.json({ error: 'not found' }, 404);
  });

  return {
    app,
    stop: () => {
      for (const w of watchers.values()) w.stop();
      watchers.clear();
    },
  };
}
