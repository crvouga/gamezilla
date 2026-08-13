import type { Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';

import { runPrefix } from '../writer/keys';
import { deleteRun, pruneRuns } from '../writer/prune';
import { readAllBytes } from '../writer/store-io';
import {
  type BucketWatcher,
  publishBucketToSubscribers,
} from './bucket-watcher';
import {
  type BucketSubscription,
  type GlobalSubscription,
  openSseStream,
  type SseHub,
} from './sse-hub';
import type { ReportBucket } from './types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function findBucket(
  buckets: readonly ReportBucket[],
  bucketId: string
): ReportBucket | undefined {
  return buckets.find((b) => b.id === bucketId);
}

async function requireBucket(
  buckets: readonly ReportBucket[],
  bucketId: string
): Promise<ReportBucket | Response> {
  const bucket = findBucket(buckets, bucketId);
  if (!bucket) return json({ error: 'bucket not found' }, 404);
  return bucket;
}

async function handlePrunePost(args: {
  readonly req: Request;
  readonly buckets: readonly ReportBucket[];
  readonly bucketId: string;
  readonly now: (() => number) | undefined;
  readonly watchers: ReadonlyMap<string, BucketWatcher>;
}): Promise<Response> {
  const { req, buckets, bucketId, now, watchers } = args;
  const bucket = await requireBucket(buckets, bucketId);
  if (bucket instanceof Response) return bucket;
  let body: { keepLast?: number; olderThanMs?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }
  if (body.olderThanMs !== undefined && now === undefined) {
    return json(
      { error: 'prune olderThanMs requires server now() clock' },
      400
    );
  }
  const deleted = await pruneRuns(bucket.store, {
    nowMs: now?.() ?? 0,
    ...(body.keepLast !== undefined ? { keepLast: body.keepLast } : {}),
    ...(body.olderThanMs !== undefined
      ? { olderThanMs: body.olderThanMs }
      : {}),
  });
  void watchers.get(bucketId)?.publishNow();
  return json({ deleted });
}

async function handleRunDelete(
  store: ObjectStore,
  runId: string,
  bucketId: string,
  watchers: ReadonlyMap<string, BucketWatcher>
): Promise<Response> {
  await deleteRun(store, runId);
  void watchers.get(bucketId)?.publishNow();
  return json({ ok: true, runId });
}

async function handleRunDataGet(
  store: ObjectStore,
  runId: string,
  rel: string
): Promise<Response> {
  if (!rel || rel.includes('\0') || rel.includes('..')) {
    return new Response('Bad request', { status: 400 });
  }
  const obj = await store.get(`${runPrefix(runId)}/${rel}`);
  if (!obj) return new Response('Not found', { status: 404 });
  const bytes = await readAllBytes(obj.body);
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Response(ab, {
    headers: {
      'content-type': obj.contentType,
      'cache-control': 'no-store',
    },
  });
}

async function handleRunScoped(args: {
  readonly req: Request;
  readonly buckets: readonly ReportBucket[];
  readonly bucketId: string;
  readonly runId: string;
  readonly rest: string;
  readonly watchers: ReadonlyMap<string, BucketWatcher>;
}): Promise<Response> {
  const { req, buckets, bucketId, runId, rest, watchers } = args;
  const bucket = await requireBucket(buckets, bucketId);
  if (bucket instanceof Response) return bucket;

  if (rest === '' || rest === '/') {
    if (req.method === 'DELETE') {
      return handleRunDelete(bucket.store, runId, bucketId, watchers);
    }
    return json({ error: 'method not allowed' }, 405);
  }

  const dataMatch = /^\/data\/(.+)$/.exec(rest);
  if (dataMatch && req.method === 'GET') {
    return handleRunDataGet(
      bucket.store,
      runId,
      decodeURIComponent(dataMatch[1]!)
    );
  }

  return json({ error: 'not found' }, 404);
}

function handleGlobalEvents(
  buckets: readonly ReportBucket[],
  hub: SseHub,
  timers: Timers
): Response {
  let sub: GlobalSubscription | null = null;
  const { response } = openSseStream({
    timers,
    onStart: (send) => {
      sub = hub.subscribeGlobal(send);
      hub.broadcastBuckets(buckets);
    },
    onCancel: () => {
      if (sub) hub.unsubscribeGlobal(sub);
    },
  });
  return response;
}

function handleBucketEvents(args: {
  readonly buckets: readonly ReportBucket[];
  readonly hub: SseHub;
  readonly bucketId: string;
  readonly runId: string | null;
  readonly testId: string | null;
  readonly timers: Timers;
}): Response | Promise<Response> {
  const { buckets, hub, bucketId, runId, testId, timers } = args;
  const bucket = findBucket(buckets, bucketId);
  if (!bucket) return json({ error: 'bucket not found' }, 404);

  let sub: BucketSubscription | null = null;
  const { response } = openSseStream({
    timers,
    onStart: (send) => {
      sub = hub.subscribeBucket(bucketId, { runId, testId, send });
      void publishBucketToSubscribers(bucket, hub);
    },
    onCancel: () => {
      if (sub) hub.unsubscribeBucket(sub);
    },
  });
  return response;
}

export type HandleApiContext = {
  readonly buckets: readonly ReportBucket[];
  readonly hub: SseHub;
  readonly watchers: ReadonlyMap<string, BucketWatcher>;
  readonly now: (() => number) | undefined;
  readonly timers: Timers;
};

/** Route `/api/*` for the report server. Returns `null` for non-API paths. */
export async function handleApi(
  req: Request,
  url: URL,
  ctx: HandleApiContext
): Promise<Response | null> {
  const { pathname } = url;
  const { buckets, hub, watchers, now, timers } = ctx;

  if (pathname === '/api/health') {
    return json({ ok: true, bucketCount: buckets.length });
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    return handleGlobalEvents(buckets, hub, timers);
  }

  const bucketEvents = /^\/api\/buckets\/([^/]+)\/events\/?$/.exec(pathname);
  if (bucketEvents && req.method === 'GET') {
    const runRaw = url.searchParams.get('run') ?? url.searchParams.get('runId');
    const testRaw =
      url.searchParams.get('test') ?? url.searchParams.get('testId');
    return handleBucketEvents({
      buckets,
      hub,
      bucketId: decodeURIComponent(bucketEvents[1]!),
      runId: runRaw && runRaw.length > 0 ? runRaw : null,
      testId: testRaw && testRaw.length > 0 ? testRaw : null,
      timers,
    });
  }

  const pruneMatch = /^\/api\/buckets\/([^/]+)\/prune\/?$/.exec(pathname);
  if (pruneMatch && req.method === 'POST') {
    return handlePrunePost({
      req,
      buckets,
      bucketId: decodeURIComponent(pruneMatch[1]!),
      now,
      watchers,
    });
  }

  const runMatch = /^\/api\/buckets\/([^/]+)\/runs\/([^/]+)(\/.*)?$/.exec(
    pathname
  );
  if (runMatch) {
    return handleRunScoped({
      req,
      buckets,
      bucketId: decodeURIComponent(runMatch[1]!),
      runId: decodeURIComponent(runMatch[2]!),
      rest: runMatch[3] ?? '',
      watchers,
    });
  }

  if (pathname.startsWith('/api/')) {
    return json({ error: 'not found' }, 404);
  }
  return null;
}
