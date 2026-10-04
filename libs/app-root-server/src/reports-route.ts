/**
 * The spec reports API: read-only views of the shared reports store (R2,
 * keyed by commit sha; `@pkgs/harness-report` owns the layout), streamed to
 * the reports screen as Server-Sent Events.
 *
 * - `GET /reports` — commits with a report, newest first (`?cursor=`)
 * - `GET /reports/:sha` — one commit's run record
 * - `GET /reports/:sha/events` — the commit, then each source as it is read;
 *   a running commit stays open and sends new sources as CI publishes them
 *   (`?have=a,b` skips the sources a reconnecting client holds)
 * - `GET /reports/:sha/sources` — every source record of the selected attempt
 * - `GET /reports/:sha/frame.css` — the stylesheet its snapshots render with
 * - `GET /reports/:sha/tests/:source/:testId` — one test's timeline, no frames
 * - `GET /reports/:sha/tests/:source/:testId/files/*` — one frame file
 * - `GET /reports/:sha/tests/:source/:testId/events` — a test, then its frames
 *
 * Mounted ahead of the per-request database middleware: nothing here touches
 * Postgres, and a long-lived stream must not hold a connection. Every
 * environment reads the same store, so any deployment serves any commit.
 */

import { apiCors } from '@libs/app-root-shared/cors';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import {
  isCommitSha,
  isFramePath,
  isKeySegment,
} from '@pkgs/harness-report-shared/keys';
import type {
  CommitEvent,
  TestEvent,
} from '@pkgs/harness-report-shared/protocol';
import {
  EVENT_STREAM_CONTENT_TYPE,
  encodeSseEvent,
} from '@pkgs/harness-report-shared/protocol';
import {
  commitEvents,
  listCommits,
  listSourceRecords,
  readCommit,
  readFrameBody,
  readFrameCss,
  readTestReport,
  testEvents,
} from '@pkgs/harness-report-shared/read';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { type Context, Hono } from 'hono';

/** Commits per page of `GET /reports`. */
export const REPORTS_PAGE_SIZE = 30;
/** How often a running commit is re-listed for new sources. */
export const REPORTS_POLL_MS = 2_000;
/** A running commit's stream ends after this long; the client reconnects. */
export const REPORTS_TAIL_MS = 5 * 60_000;

export type ReportsAppDeps = {
  /** The shared reports store; null when this deployment has no credential. */
  readonly store: ObjectStore | null;
  readonly clock: Clock;
  readonly timers: Timers;
};

const NO_STORE = { 'cache-control': 'no-store' } as const;

function eventStream(
  events: AsyncGenerator<CommitEvent | TestEvent>
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await events.next();
      if (next.done === true) controller.close();
      else controller.enqueue(encoder.encode(encodeSseEvent(next.value)));
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': EVENT_STREAM_CONTENT_TYPE,
      'x-accel-buffering': 'no',
      ...NO_STORE,
    },
  });
}

function bytesResponse(
  bytes: Uint8Array,
  headers: Record<string, string>
): Response {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Response(copy, { status: 200, headers });
}

function frameFileParam(raw: string | undefined): string | null {
  if (raw === undefined || raw.length === 0) return null;
  let file: string;
  try {
    file = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return isFramePath(file) ? file : null;
}

function haveSources(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? '').split(',').filter(isKeySegment));
}

function unavailable(): Response {
  return Response.json(
    { error: 'reports_unavailable' },
    { status: 503, headers: NO_STORE }
  );
}

function notFound(): Response {
  return Response.json(
    { error: 'not_found' },
    { status: 404, headers: NO_STORE }
  );
}

function storeOf(
  deps: ReportsAppDeps,
  sha: string
): NonNullable<ReportsAppDeps['store']> | Response {
  if (!isCommitSha(sha)) return notFound();
  if (deps.store === null) return unavailable();
  return deps.store;
}

function testParams(c: Context):
  | Response
  | {
      readonly sha: string;
      readonly source: string;
      readonly testId: string;
    } {
  const sha = c.req.param('sha');
  const source = c.req.param('source');
  const testId = c.req.param('testId');
  if (
    sha === undefined ||
    source === undefined ||
    testId === undefined ||
    !isCommitSha(sha) ||
    !isKeySegment(source) ||
    !isKeySegment(testId)
  ) {
    return notFound();
  }
  return { sha, source, testId };
}

function sourcesRoute(deps: ReportsAppDeps) {
  return async (c: Context) => {
    const sha = c.req.param('sha') ?? '';
    const store = storeOf(deps, sha);
    if (store instanceof Response) return store;
    const sources = await listSourceRecords(store, sha);
    return c.json({ sources }, 200, NO_STORE);
  };
}

function testRoute(deps: ReportsAppDeps) {
  return async (c: Context) => {
    const params = testParams(c);
    if (params instanceof Response) return params;
    const store = storeOf(deps, params.sha);
    if (store instanceof Response) return store;
    const report = await readTestReport(store, params);
    if (report === null) return notFound();
    return c.json(report, 200, NO_STORE);
  };
}

/** Hono's tail `*` matches the rest of the path and does not expose it. */
function frameFileOf(
  url: string,
  params: { readonly source: string; readonly testId: string }
): string | null {
  const marker = `/tests/${params.source}/${params.testId}/files/`;
  const path = new URL(url).pathname;
  const at = path.indexOf(marker);
  if (at < 0) return null;
  return frameFileParam(path.slice(at + marker.length));
}

function fileRoute(deps: ReportsAppDeps) {
  return async (c: Context) => {
    const params = testParams(c);
    if (params instanceof Response) return params;
    const file = frameFileOf(c.req.url, params);
    if (file === null) return notFound();
    const store = storeOf(deps, params.sha);
    if (store instanceof Response) return store;
    const body = await readFrameBody(store, { ...params, file });
    if (body === null) return notFound();
    return bytesResponse(body.bytes, {
      'content-type': body.contentType,
      ...NO_STORE,
    });
  };
}

function testEventsRoute(deps: ReportsAppDeps) {
  return (c: Context) => {
    const params = testParams(c);
    if (params instanceof Response) return params;
    const store = storeOf(deps, params.sha);
    if (store instanceof Response) return store;
    return eventStream(testEvents(store, params));
  };
}

export function createReportsApp(deps: ReportsAppDeps) {
  return new Hono()
    .use('*', apiCors)
    .get('/', async (c) => {
      if (deps.store === null) return unavailable();
      const page = await listCommits(deps.store, {
        limit: REPORTS_PAGE_SIZE,
        cursor: c.req.query('cursor') ?? null,
      });
      return c.json(page, 200, NO_STORE);
    })
    .get('/:sha', async (c) => {
      const sha = c.req.param('sha');
      if (!isCommitSha(sha)) return notFound();
      if (deps.store === null) return unavailable();
      const commit = await readCommit(deps.store, sha);
      return commit === null ? notFound() : c.json(commit, 200, NO_STORE);
    })
    .get('/:sha/events', (c) => {
      const sha = c.req.param('sha');
      if (!isCommitSha(sha)) return notFound();
      if (deps.store === null) return unavailable();
      return eventStream(
        commitEvents(deps.store, sha, {
          clock: deps.clock,
          timers: deps.timers,
          have: haveSources(c.req.query('have')),
          pollMs: REPORTS_POLL_MS,
          tailMs: REPORTS_TAIL_MS,
        })
      );
    })
    .get('/:sha/sources', sourcesRoute(deps))
    .get('/:sha/frame.css', async (c) => {
      const sha = c.req.param('sha');
      if (!isCommitSha(sha)) return notFound();
      if (deps.store === null) return unavailable();
      const css = await readFrameCss(deps.store, sha);
      if (css === null) return notFound();
      return new Response(css.body, {
        status: 200,
        headers: {
          'content-type': css.contentType,
          ...NO_STORE,
        },
      });
    })
    .get('/:sha/tests/:source/:testId', testRoute(deps))
    .get('/:sha/tests/:source/:testId/files/*', fileRoute(deps))
    .get('/:sha/tests/:source/:testId/events', testEventsRoute(deps));
}
