// @io-wall-ok — local development backend composition root

import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { FileSystemIssueReporter } from '../src/server/filesystem-issue-reporter.ts';
import {
  FEEDBACK_PATH,
  createFeedbackReportHandler,
  MAX_REPORT_BYTES,
} from '../src/server/http-handler.ts';

export { FEEDBACK_PATH };

export function createDevReportDispatcher(repoRoot: string) {
  const reporter = new FileSystemIssueReporter(
    createNodeFsObjectStore({
      rootDir: resolve(repoRoot, '.feedback'),
      fs: wallNodeFs(),
      layout: 'tree',
    })
  );
  return (request: IncomingMessage, response: ServerResponse) =>
    dispatch(request, response, reporter);
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  reporter: FileSystemIssueReporter
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
    if (size > MAX_REPORT_BYTES) {
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
  const request = new Request(`${origin}${FEEDBACK_PATH}`, {
    method,
    headers,
    ...(method === 'POST' ? { body } : {}),
  });
  const response = await createFeedbackReportHandler({
    reporter,
    clock: wallClock,
    allowedOrigin: origin,
  })(request);
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(await response.text());
}
