// @io-wall-ok — local development backend composition root

import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
  MAX_REQUEST_BYTES,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { fileBugReportIssues } from '@pkgs/feedback-server-ts/file-bug-report-issues';
import { localIssueReporter } from '@pkgs/feedback-server-ts/local-issue-reporter';
import { reconcileFeedbackPostgres } from '@pkgs/feedback-server-ts/reconcile';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

export { BUG_REPORT_PATH };

/** The queue lives in this process: `.feedback/` is what development keeps. */
async function openDevQueue(): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    now: () => new Date(wallClock.now()),
  });
  await db.connect();
  await reconcileFeedbackPostgres(db);
  return db;
}

export function createDevReportDispatcher(repoRoot: string) {
  const store = createNodeFsObjectStore({
    rootDir: resolve(repoRoot, '.feedback'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const queue = openDevQueue();
  return async (request: IncomingMessage, response: ServerResponse) =>
    dispatch(request, response, { store, db: await queue });
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  backend: { readonly store: ObjectStore; readonly db: SqlClient }
): Promise<void> {
  const origin = `http://${req.headers.host ?? 'localhost'}`;
  const hostname = new URL(origin).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    res.statusCode = 403;
    res.end('Local reporting only');
    return;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = new Uint8Array(chunk as Uint8Array);
    size += bytes.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      res.statusCode = 413;
      res.end('Bug report too large');
      return;
    }
    chunks.push(bytes);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }
  const method = req.method ?? 'GET';
  const request = new Request(`${origin}${req.url}`, {
    method,
    headers,
    ...(method === 'POST' ? { body } : {}),
  });
  const response = await createBugReportHttpApp({
    ...backend,
    clock: wallClock,
    allowedOrigins: [origin],
  })(request);
  // Development files at once: the archive under `.feedback/` is the issue.
  if (response.status === 201)
    await fileBugReportIssues({
      ...backend,
      reporter: localIssueReporter,
      clock: wallClock,
      limit: 10,
    });
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(new Uint8Array(await response.arrayBuffer()));
}
