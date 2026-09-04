// @io-wall-ok — process entry: Bun.serve + wall Node-FS report + snapshot stores.
/**
 * Local report console for `@product/console` `dev`. Serves
 * `<repo>/.cache/sim-console-data` so Jest UI sims (`openSim`) show up in Reports.
 * Playground snapshots use the same Node-FS root under `playground-snapshots/`.
 */
import { join } from 'node:path';

import { wallClock, wallTimers } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { resolveLocalReportDataDir } from '@pkgs/sim-console/local-data-dir';
import { createSimConsoleApp } from '@pkgs/sim-console/server';
import { bunSqliteDumpToSqlm } from '@pkgs/sim-console/server/bun-sqlite-dump-to-sqlm';
import { DEFAULT_REPORT_SERVER_PORT } from '@pkgs/sim-console/types';
import { wallPathExists } from '@pkgs/sim-console/wall-path-exists';

export type LocalReportConsoleHandle = {
  readonly stop: () => void;
};

function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get('Origin') ?? '*';
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, HEAD, PUT, POST, DELETE, OPTIONS'
  );
  const requested = req.headers.get('Access-Control-Request-Headers');
  headers.set(
    'Access-Control-Allow-Headers',
    requested && requested.length > 0
      ? requested
      : 'Content-Type, Authorization, Cache-Control, Pragma'
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function startLocalReportConsole(): Promise<LocalReportConsoleHandle> {
  const dataDir = resolveLocalReportDataDir(process.cwd(), wallPathExists);
  const store = createNodeFsObjectStore({
    rootDir: dataDir,
    fs: wallNodeFs(),
    layout: 'sidecar',
  });
  const snapshotStore = store.withPrefix(ObjectStorePrefix.playgroundSnapshots);

  const { app, stop: stopApp } = createSimConsoleApp({
    buckets: [{ id: 'local', label: 'Local', store }],
    timers: wallTimers,
    now: () => wallClock.now(),
    convertSqliteDumpToSqlm: ({ bytes, nowMs }) =>
      bunSqliteDumpToSqlm(bytes, nowMs),
    playgroundSnapshotStore: snapshotStore,
  });

  const server = Bun.serve({
    port: DEFAULT_REPORT_SERVER_PORT,
    hostname: '127.0.0.1',
    async fetch(req) {
      if (req.method === 'OPTIONS') {
        return withCors(req, new Response(null, { status: 204 }));
      }
      const res = await app.fetch(req);
      return withCors(req, res);
    },
  });

  process.stdout.write(
    `[sim-console] local reports http://127.0.0.1:${String(DEFAULT_REPORT_SERVER_PORT)} ← ${dataDir}\n`
  );
  process.stdout.write(
    `[sim-console] playground snapshots → ${join(dataDir, ObjectStorePrefix.playgroundSnapshots.replace(/\/$/, ''))}\n`
  );

  return {
    stop: () => {
      stopApp();
      server.stop(true);
    },
  };
}
