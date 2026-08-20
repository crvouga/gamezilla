// @io-wall-ok — process entry: Bun.serve + wall Node-FS report store + S3 snapshots.
/**
 * Local report console for `@apps/system` `dev`. Serves
 * `<repo>/system-console-data` so Jest UI sims (`openSim`) show up in Reports.
 * Playground snapshots use S3 from secrets-run (B2_APP_* / S3_*), not Node-FS.
 */
import { createApiObjectStore } from '@apps/server/config/object-store';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { resolveLocalReportDataDir } from '@pkgs/system-console/local-data-dir';
import { createSystemConsoleApp } from '@pkgs/system-console/server';
import { bunSqliteDumpToSqlm } from '@pkgs/system-console/server/bun-sqlite-dump-to-sqlm';
import { DEFAULT_REPORT_SERVER_PORT } from '@pkgs/system-console/types';
import { wallPathExists } from '@pkgs/system-console/wall-path-exists';

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

async function createPlaygroundSnapshotS3Store(): Promise<ObjectStore | null> {
  try {
    const root = await createApiObjectStore(createScriptSecretStore(), {
      now: () => wallClock.now(),
      requireCredentials: true,
    });
    return root.withPrefix(ObjectStorePrefix.playgroundSnapshots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[system-console] playground snapshots S3 unavailable: ${message}\n`
    );
    return null;
  }
}

export async function startLocalReportConsole(): Promise<LocalReportConsoleHandle> {
  const dataDir = resolveLocalReportDataDir(process.cwd(), wallPathExists);
  const store = createNodeFsObjectStore({
    rootDir: dataDir,
    fs: wallNodeFs(),
    layout: 'sidecar',
  });
  const snapshotStore = await createPlaygroundSnapshotS3Store();

  const { app, stop: stopApp } = createSystemConsoleApp({
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
    `[system-console] local reports http://127.0.0.1:${String(DEFAULT_REPORT_SERVER_PORT)} ← ${dataDir}\n`
  );
  if (snapshotStore !== null) {
    process.stdout.write(
      `[system-console] playground snapshots → S3 (${ObjectStorePrefix.playgroundSnapshots})\n`
    );
  }

  return {
    stop: () => {
      stopApp();
      server.stop(true);
    },
  };
}
