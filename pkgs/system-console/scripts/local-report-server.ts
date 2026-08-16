// @io-wall-ok — process entry: Bun.serve + wall Node-FS report store for local Console.
/**
 * Local report console for `bun dev`. Serves `<repo>/system-console-data` so
 * Jest UI sims (`openSim`) show up in the product Console → Reports tab.
 * Production / remote browsing still uses the API Worker `/system-console`
 * mount (MinIO / B2).
 */
import { wallTimers } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';

import { resolveLocalReportDataDir } from '../src/local-data-dir';
import { createSystemConsoleApp } from '../src/server/create-system-console-app';
import { DEFAULT_REPORT_SERVER_PORT } from '../src/types';
import { wallPathExists } from '../src/wall-path-exists';

const dataDir = resolveLocalReportDataDir(process.cwd(), wallPathExists);
const store = createNodeFsObjectStore({
  rootDir: dataDir,
  fs: wallNodeFs(),
  layout: 'sidecar',
});

const { app, stop } = createSystemConsoleApp({
  buckets: [{ id: 'local', label: 'Local', store }],
  timers: wallTimers,
  now: () => Date.now(),
});

function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get('Origin') ?? '*';
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, HEAD, POST, DELETE, OPTIONS'
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

function shutdown(): void {
  stop();
  server.stop(true);
  process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, shutdown);
}
