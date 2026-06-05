/**
 * Start Expo web dev behind a loopback reverse proxy on :5173.
 *
 * Metro listens on `EXPO_METRO_PORT` (default 5174). The proxy on
 * `EXPO_DEV_PORT` (default 5173) forwards `/api/*`, `/auth/*`, `/patch-db/*`,
 * and `/room` WebSockets to wrangler so `getApiBaseUrl()` same-origin logic
 * works during `bun dev`, matching `preview-server.ts` / Playwright.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startWebDevProxyServer } from './local-api-proxy';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');
const proxyPort = String(process.env['EXPO_DEV_PORT'] ?? 5173);
const metroPort = String(process.env['EXPO_METRO_PORT'] ?? 5174);

function spawnDevServer(passthrough: string[]): ChildProcess {
  const args = [
    'start',
    '--web',
    '--port',
    metroPort,
    '--clear',
    ...passthrough,
  ];
  process.stdout.write(`[client-dev] expo ${args.join(' ')}\n`);
  return spawn(
    'sh',
    [
      '-c',
      'ulimit -n 65536 2>/dev/null || true; exec "$0" "$@"',
      expoBin,
      ...args,
    ],
    {
      stdio: 'inherit',
      cwd: clientRoot,
      env: process.env,
    }
  );
}

const proxy = startWebDevProxyServer({
  port: Number(proxyPort),
  webTarget: `http://127.0.0.1:${metroPort}`,
  logLabel: 'client-dev-proxy',
});

process.stdout.write(
  `[client-dev] open ${proxy.url.origin} (metro :${metroPort})\n`
);

const child = spawnDevServer(
  process.argv.slice(2).filter((arg) => arg !== '--')
);

function shutdown(sig: NodeJS.Signals): void {
  child.kill(sig);
  void proxy.stop(true);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    shutdown(sig);
  });
}

child.on('exit', (code) => {
  void proxy.stop(true);
  process.exit(code ?? 0);
});
