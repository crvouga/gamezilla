// @io-wall-ok — Vite dev middleware composition root for `/api/reports`
import { createReportsObjectStore } from '@libs/server-app/config/object-store';
import { createReportsApp } from '@libs/server-app/reports/route';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { RecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import { Hono } from 'hono';

import { loadReportsDevSecrets } from './reports-dev-credentials';

type FetchApp = {
  fetch: (request: Request) => Promise<Response> | Response;
};

let cached: Promise<FetchApp> | null = null;

export function reportsDevFetch(
  request: Request,
  repoRoot: string
): Promise<Response> {
  cached ??= openReportsDevApp(repoRoot);
  return cached.then((app) => app.fetch(request));
}

async function openReportsDevApp(repoRoot: string): Promise<FetchApp> {
  const store = await createReportsObjectStore(
    new RecordSecretStore(loadReportsDevSecrets(repoRoot)),
    { http: createGlobalHttpClient() }
  );
  return new Hono().route(
    '/api/reports',
    createReportsApp({ store, clock: wallClock, timers: wallTimers })
  );
}
