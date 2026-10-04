// @io-wall-ok — local development backend composition root

import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { wallClock } from '@pkgs/clock-shared/wall';
import { MAX_EVIDENCE_BYTES } from '@pkgs/feedback-server/evidence-handler';
import { createFeedbackHttpApp } from '@pkgs/feedback-server/feedback-http-app';
import { FileSystemIssueReporter } from '@pkgs/feedback-server/filesystem-issue-reporter';
import { MAX_REPORT_BYTES } from '@pkgs/feedback-server/http-handler';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

export function createDevReportDispatcher(repoRoot: string) {
  const store = createNodeFsObjectStore({
    rootDir: resolve(repoRoot, '.feedback'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const reporter = new FileSystemIssueReporter(store);
  return (request: IncomingMessage, response: ServerResponse) =>
    dispatch(request, response, { reporter, store });
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    reporter: FileSystemIssueReporter;
    store: import('@pkgs/object-store-shared/interface').ObjectStore;
  }
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
    if (
      size >
      (req.url?.includes('/evidence/') ? MAX_EVIDENCE_BYTES : MAX_REPORT_BYTES)
    ) {
      res.statusCode = 413;
      res.end('Report too large');
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
    ...(['POST', 'PATCH'].includes(method) ? { body } : {}),
  });
  const response = await createFeedbackHttpApp({
    ...options,
    clock: wallClock,
    allowedOrigin: origin,
  })(request);
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(new Uint8Array(await response.arrayBuffer()));
}
