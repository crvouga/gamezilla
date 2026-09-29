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
 * - `GET /reports/:sha/frame.css` — the stylesheet its snapshots render with
 * - `GET /reports/:sha/tests/:source/:testId/events` — a test, then its frames
 *
 * Mounted ahead of the per-request database middleware: nothing here touches
 * Postgres, and a long-lived stream must not hold a connection. Every
 * environment reads the same store, so any deployment serves any commit.
 */

import type { Clock, Timers } from '@pkgs/clock';
import {
  type CommitEvent,
  commitEvents,
  EVENT_STREAM_CONTENT_TYPE,
  encodeSseEvent,
  frameCssKey,
  isCommitSha,
  isKeySegment,
  listCommits,
  readCommit,
  type TestEvent,
  testEvents,
} from '@pkgs/harness-report';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { Hono } from 'hono';

import { apiCors } from '../app/cors';

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

function haveSources(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? '').split(',').filter(isKeySegment));
}

export function createReportsApp(deps: ReportsAppDeps) {
  const unavailable = () =>
    Response.json(
      { error: 'reports_unavailable' },
      { status: 503, headers: NO_STORE }
    );
  const notFound = () =>
    Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

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
    .get('/:sha/frame.css', async (c) => {
      const sha = c.req.param('sha');
      if (!isCommitSha(sha)) return notFound();
      if (deps.store === null) return unavailable();
      const css = await deps.store.get(frameCssKey(sha));
      if (css === null) return notFound();
      return new Response(css.body, {
        status: 200,
        headers: {
          'content-type': css.contentType,
          'cache-control': 'public, max-age=300',
        },
      });
    })
    .get('/:sha/tests/:source/:testId/events', (c) => {
      const sha = c.req.param('sha');
      const source = c.req.param('source');
      const testId = c.req.param('testId');
      if (!isCommitSha(sha) || !isKeySegment(source) || !isKeySegment(testId)) {
        return notFound();
      }
      if (deps.store === null) return unavailable();
      return eventStream(testEvents(deps.store, { sha, source, testId }));
    });
}
