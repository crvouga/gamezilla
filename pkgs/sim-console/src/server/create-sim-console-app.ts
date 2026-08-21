import type { Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { Hono } from 'hono';

import {
  type ConvertSqliteDumpToSqlm,
  type HandleApiContext,
  handleApi,
} from './api-routes';
import { type BucketWatcher, startBucketWatcher } from './bucket-watcher';
import { handlePlaygroundSnapshotObjectRequest } from './playground-snapshot-object-routes';
import { SseHub } from './sse-hub';
import type { ReportBucket } from './types';

export type { ConvertSqliteDumpToSqlm };

export type CreateSimConsoleAppOptions = {
  readonly buckets: readonly ReportBucket[];
  readonly timers: Timers;
  /** Clock for prune `olderThanMs` (inject from composition root). */
  readonly now?: () => number;
  /**
   * Optional: serve `?format=sqlm` on gzipped native dumps (Bun local report
   * servers). Workers leave this unset — Expo cannot load sqlite-wasm.
   */
  readonly convertSqliteDumpToSqlm?: ConvertSqliteDumpToSqlm;
  /**
   * Optional playground snapshot ObjectStore (Node-FS locally). Pass `null`
   * when unavailable so the HTTP proxy returns 503 instead of a silent miss.
   * Omit when this host does not serve playground snapshots.
   */
  readonly playgroundSnapshotStore?: ObjectStore | null;
};

export type SimConsoleAppHandle = {
  readonly app: Hono;
  readonly stop: () => void;
};

/**
 * Library Hono app for simulation report buckets (SSE + REST).
 * Mount under `/sim-console` (or any prefix); routes are `/api/*`.
 */
export function createSimConsoleApp(
  options: CreateSimConsoleAppOptions
): SimConsoleAppHandle {
  const buckets = options.buckets;
  if (buckets.length === 0) {
    throw new Error('createSimConsoleApp: buckets must be non-empty');
  }
  const ids = new Set(buckets.map((b) => b.id));
  if (ids.size !== buckets.length) {
    throw new Error('createSimConsoleApp: bucket ids must be unique');
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
    convertSqliteDumpToSqlm: options.convertSqliteDumpToSqlm,
  };

  const snapshotStore = options.playgroundSnapshotStore;
  const serveSnapshots = snapshotStore !== undefined;

  const app = new Hono();
  app.all('*', async (c) => {
    const url = new URL(c.req.url);
    // Hono keeps the full request path on `c.req.path` even when mounted via
    // `.route('/sim-console', app)`. Route matching expects `/api/*`, so
    // slice from the `/api` segment (works at root or under any mount prefix).
    const fullPath = c.req.path;
    const apiIdx = fullPath.indexOf('/api');
    url.pathname = apiIdx >= 0 ? fullPath.slice(apiIdx) : fullPath;
    if (serveSnapshots) {
      const method = c.req.method;
      const snapReq =
        method === 'GET' || method === 'HEAD'
          ? new Request(url.toString(), {
              method,
              headers: c.req.raw.headers,
            })
          : new Request(url.toString(), {
              method,
              headers: c.req.raw.headers,
              body: await c.req.arrayBuffer(),
            });
      const snapRes = await handlePlaygroundSnapshotObjectRequest(
        snapReq,
        snapshotStore
      );
      if (snapRes !== null) return snapRes;
    }
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
