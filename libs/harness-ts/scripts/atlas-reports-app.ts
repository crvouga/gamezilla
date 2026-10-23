// @io-wall-ok — Vite dev middleware composition root for `/api/reports`

import { join } from 'node:path';
import type { WorkspaceReports } from '@crvouga/atlas/reports/explorer-types';
import { createReportsApp } from '@crvouga/atlas/reports/reports-route';
import { compileFrameCss } from '@libs/harness-ts/wall-frame-css';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { createLayeredObjectStore } from '@pkgs/object-store-root-shared-ts/impl-layered';
import { RecordSecretStore } from '@pkgs/secret-store-shared-ts/record-secret-store';
import { Hono } from 'hono';
import { workspaceOutline } from './atlas-outline';
import { createReportsObjectStore } from './atlas-report-store';
import { loadReportsDevSecrets } from './atlas-reports-credentials';
import { workspaceReports } from './atlas-workspace-reports';
import { reportBranch, reportRevision } from './report-origin';

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

export async function openReportsDevApp(
  repoRoot: string,
  workspace: () => Promise<WorkspaceReports> = () => workspaceReports(repoRoot),
  outline = () => workspaceOutline(repoRoot)
): Promise<FetchApp> {
  const remoteStore = await createReportsObjectStore(
    new RecordSecretStore(loadReportsDevSecrets(repoRoot)),
    { http: createGlobalHttpClient() }
  );
  const cacheStore = createNodeFsObjectStore({
    rootDir: join(repoRoot, '.cache/atlas-reports-cache'),
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const store = remoteStore
    ? createLayeredObjectStore({
        primary: remoteStore,
        caches: [cacheStore],
        now: () => wallClock.now(),
        cacheTtlMs: 2_000,
        staleOnError: true,
      })
    : null;
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
      workspace,
      outline,
      // A running suite's finished tests, read from the bucket it writes.
      live: {
        bucket: (run) =>
          /^(apps|libs|pkgs)\/[a-z0-9-]+$/.test(run.packageDir) &&
          /^[a-z0-9-]+$/.test(run.bucket)
            ? createNodeFsObjectStore({
                rootDir: join(
                  repoRoot,
                  run.packageDir,
                  '.cache/harness-report',
                  run.bucket
                ),
                fs: wallNodeFs(),
                layout: 'tree',
              })
            : null,
        origin: async () => ({
          sha: reportRevision(repoRoot),
          branch: reportBranch(repoRoot),
        }),
        frameCss: async () => compileFrameCss(repoRoot),
      },
    })
  );
}
