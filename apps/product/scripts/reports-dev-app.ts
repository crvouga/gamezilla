// @io-wall-ok — Vite dev middleware composition root for `/api/reports`

import { join } from 'node:path';
import { createReportsObjectStore } from '@libs/app-root-server/object-store';
import { createReportsApp } from '@libs/app-root-server/reports-route';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { RecordSecretStore } from '@pkgs/secret-store-shared/record-secret-store';
import { Hono } from 'hono';

import { loadReportsDevSecrets } from './reports-dev-credentials';
import { workspaceReports } from './workspace-reports';

type FetchApp = {
  fetch: (request: Request) => Promise<Response> | Response;
};

let cached: Promise<FetchApp> | null = null;

export function reportsDevFetch(
  request: Request,
  repoRoot: string
): Promise<Response> {
  cached ??= openReportsDevApp(repoRoot).catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached.then((app) => app.fetch(request));
}

async function openReportsDevApp(repoRoot: string): Promise<FetchApp> {
  const store = await createReportsObjectStore(
    new RecordSecretStore(loadReportsDevSecrets(repoRoot)),
    { http: createGlobalHttpClient() }
  );
  return new Hono().route(
    '/api/reports',
    createReportsApp({
      store,
      localStore: createNodeFsObjectStore({
        rootDir: join(repoRoot, '.cache/local-reports'),
        fs: wallNodeFs(),
        layout: 'tree',
      }),
      clock: wallClock,
      timers: wallTimers,
      workspace: () => workspaceReports(repoRoot),
    })
  );
}
