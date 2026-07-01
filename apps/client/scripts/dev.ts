/**
 * Start Expo web dev behind a loopback reverse proxy on :5173.
 *
 * Metro listens on `EXPO_METRO_PORT` (default 5174). The proxy on
 * `EXPO_DEV_PORT` (default 5173) forwards `/api/*` (including WebSocket
 * `/api/room`) to wrangler so `getApiBaseUrl()` same-origin logic
 * works during `bun dev`, matching `preview-server.ts` / Playwright.
 *
 * On macOS, auto-opens the project-dedicated iOS simulator with the
 * development build once Metro is ready (`EXPO_DEV_AUTO_IOS=0` to disable).
 *
 * Metro cache is project-local (`node_modules/.cache/metro`). We do not pass
 * `--clear` on every start — it races on the shared system temp store. Opt in
 * to a reset with `EXPO_DEV_CLEAR=1`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  autoOpenDedicatedSim,
  isAutoOpenIosEnabled,
  SIM_NAME,
} from './ios-dedicated-sim';
import { configureMetroWatchmanEnv } from './metro-watchman-env';
import { startWebDevProxyServer } from './local-api-proxy';
import { maybeClearMetroCache } from './metro-dev-cache';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const monorepoRoot = join(clientRoot, '../..');
maybeClearMetroCache(clientRoot);

const devEnv = configureMetroWatchmanEnv({ monorepoRoot, clientRoot });
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');
const proxyPort = String(process.env['EXPO_DEV_PORT'] ?? 5173);
const metroPort = String(process.env['EXPO_METRO_PORT'] ?? 5174);

function spawnDevServer(passthrough: string[]): ChildProcess {
  const args = ['start', '--web', '--port', metroPort, ...passthrough];
  process.stdout.write(`[client-dev] expo ${args.join(' ')}\n`);
  return spawn(
    'sh',
    [
      '-c',
      'ulimit -n 1048576 2>/dev/null || ulimit -n 65536 2>/dev/null || true; exec "$0" "$@"',
      expoBin,
      ...args,
    ],
    {
      stdio: 'inherit',
      cwd: clientRoot,
      env: devEnv,
    }
  );
}

const abort = new AbortController();

const proxy = startWebDevProxyServer({
  port: Number(proxyPort),
  webTarget: `http://127.0.0.1:${metroPort}`,
  logLabel: 'client-dev-proxy',
});

process.stdout.write(
  `[client-dev] open ${proxy.url.origin} (metro :${metroPort})\n`
);
if (isAutoOpenIosEnabled()) {
  process.stderr.write(
    `[client-dev] iOS sim "${SIM_NAME}" will open when Metro is ready (EXPO_DEV_AUTO_IOS=0 to disable).\n`
  );
}

const child = spawnDevServer(
  process.argv.slice(2).filter((arg) => arg !== '--')
);

function shutdown(sig: NodeJS.Signals): void {
  abort.abort();
  child.kill(sig);
  void proxy.stop(true);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    shutdown(sig);
  });
}

child.on('exit', (code) => {
  abort.abort();
  void proxy.stop(true);
  process.exit(code ?? 0);
});

if (isAutoOpenIosEnabled()) {
  const metroUrl = `http://127.0.0.1:${metroPort}`;
  void autoOpenDedicatedSim({
    metroUrl,
    abort: abort.signal,
  }).catch((err: unknown) => {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[client-dev] iOS sim auto-open failed: ${msg}\n`);
    process.stderr.write(
      `[client-dev] Web dev still available at http://127.0.0.1:${proxyPort}\n`
    );
    process.stderr.write(
      `[client-dev] Install dev client manually: bunx expo run:ios --device "${SIM_NAME}"\n`
    );
  });
}
