import type { ObjectStore } from '@pkgs/object-store/interface';

import type { SimulationReportData, SuiteManifest } from '../types';
import { runManifestKey, runPrefix, testStepsKey } from '../writer/keys';
import { deleteRun, pruneRuns } from '../writer/prune';
import {
  loadRunsIndex,
  readAllBytes,
  readGeneration,
  storeGetJson,
} from '../writer/store-io';
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

async function handleGenerationGet(
  buckets: readonly ReportBucket[],
  bucketId: string
): Promise<Response> {
  const bucket = await requireBucket(buckets, bucketId);
  if (bucket instanceof Response) return bucket;
  return json({ generation: await readGeneration(bucket.store) });
}

async function handleRunsListGet(
  buckets: readonly ReportBucket[],
  bucketId: string
): Promise<Response> {
  const bucket = await requireBucket(buckets, bucketId);
  if (bucket instanceof Response) return bucket;
  return json(await loadRunsIndex(bucket.store));
}

async function handlePrunePost(
  req: Request,
  buckets: readonly ReportBucket[],
  bucketId: string,
  now: (() => number) | undefined
): Promise<Response> {
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
  return json({ deleted });
}

async function handleRunDelete(
  store: ObjectStore,
  runId: string
): Promise<Response> {
  await deleteRun(store, runId);
  return json({ ok: true, runId });
}

async function handleManifestGet(
  store: ObjectStore,
  runId: string
): Promise<Response> {
  const manifest =
    (await storeGetJson<SuiteManifest>(store, runManifestKey(runId))) ??
    ({ tests: [], updatedAtMs: 0 } satisfies SuiteManifest);
  return json(manifest);
}

async function handleTestGet(
  store: ObjectStore,
  runId: string,
  testId: string
): Promise<Response> {
  const data = await storeGetJson<SimulationReportData>(
    store,
    testStepsKey(runId, testId)
  );
  if (!data) return json({ error: 'test not found', testId }, 404);
  return json(data);
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
}): Promise<Response> {
  const { req, buckets, bucketId, runId, rest } = args;
  const bucket = await requireBucket(buckets, bucketId);
  if (bucket instanceof Response) return bucket;

  if (rest === '' || rest === '/') {
    if (req.method === 'DELETE') {
      return handleRunDelete(bucket.store, runId);
    }
    return json({ error: 'method not allowed' }, 405);
  }

  if ((rest === '/manifest' || rest === '/manifest/') && req.method === 'GET') {
    return handleManifestGet(bucket.store, runId);
  }

  const testMatch = /^\/tests\/([^/]+)\/?$/.exec(rest);
  if (testMatch && req.method === 'GET') {
    return handleTestGet(
      bucket.store,
      runId,
      decodeURIComponent(testMatch[1]!)
    );
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

/** Route `/api/*` for the report server. Returns `null` for non-API paths. */
export async function handleApi(
  req: Request,
  url: URL,
  buckets: readonly ReportBucket[],
  now: (() => number) | undefined
): Promise<Response | null> {
  const { pathname } = url;

  if (pathname === '/api/health') {
    return json({ ok: true, bucketCount: buckets.length });
  }

  if (pathname === '/api/buckets' && req.method === 'GET') {
    return json(buckets.map((b) => ({ id: b.id, label: b.label })));
  }

  const genMatch = /^\/api\/buckets\/([^/]+)\/generation\/?$/.exec(pathname);
  if (genMatch && req.method === 'GET') {
    return handleGenerationGet(buckets, decodeURIComponent(genMatch[1]!));
  }

  const runsMatch = /^\/api\/buckets\/([^/]+)\/runs\/?$/.exec(pathname);
  if (runsMatch && req.method === 'GET') {
    return handleRunsListGet(buckets, decodeURIComponent(runsMatch[1]!));
  }

  const pruneMatch = /^\/api\/buckets\/([^/]+)\/prune\/?$/.exec(pathname);
  if (pruneMatch && req.method === 'POST') {
    return handlePrunePost(
      req,
      buckets,
      decodeURIComponent(pruneMatch[1]!),
      now
    );
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
    });
  }

  if (pathname.startsWith('/api/')) {
    return json({ error: 'not found' }, 404);
  }
  return null;
}
