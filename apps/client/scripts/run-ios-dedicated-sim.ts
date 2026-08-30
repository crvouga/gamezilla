/**
 * Run the Expo dev server pinned to a type+runtime iOS simulator.
 *
 * See `ios-dedicated-sim.ts` for simulator provisioning and dev-client install.
 *
 * Extra argv (`--web`, `--tunnel`, etc.) is forwarded to `expo start`.
 *
 * Configurable via env (all optional):
 *   EXPO_DEV_SIM_NAME         default kebab-case of device type + runtime
 *                             (e.g. `iphone-17-pro-ios-26-0`)
 *   EXPO_DEV_SIM_DEVICE_TYPE  default iPhone 17 Pro
 *   EXPO_DEV_SIM_RUNTIME      default: highest-version available iOS runtime
 *   EXPO_METRO_PORT           default 5173
 *   EXPO_DEV_AUTO_IOS         set `0` to skip auto-opening the sim
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoOpenDedicatedSim,
  isAutoOpenIosEnabled,
  isDevServerRunning,
  resolveSimName,
} from './ios-dedicated-sim';
import { maybeClearMetroCache } from './metro-dev-cache';

const EXPO_PORT = Number(process.env['EXPO_METRO_PORT'] ?? 5173);
const EXPO_HOST = '127.0.0.1';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
maybeClearMetroCache(clientRoot);
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');

function log(message: string): void {
  process.stderr.write(`[ios-dev] ${message}\n`);
}

function spawnExpo(passthrough: string[]): ChildProcess {
  const args = ['start', '--port', String(EXPO_PORT), ...passthrough];
  log(`expo ${args.join(' ')}`);
  return spawn(expoBin, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: clientRoot,
  });
}

function waitForShutdown(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = (): void => {
      cleanup();
      resolve();
    };
    const onSig = (): void => {
      cleanup();
      resolve();
    };
    const cleanup = (): void => {
      signal.removeEventListener('abort', onAbort);
      for (const sig of ['SIGINT', 'SIGTERM'] as const) {
        process.removeListener(sig, onSig);
      }
    };
    signal.addEventListener('abort', onAbort);
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
      process.on(sig, onSig);
    }
  });
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    process.stderr.write(
      '[ios-dev] iOS Simulator is only supported on macOS. Use `bun run --filter @apps/client web` instead.\n'
    );
    process.exit(1);
  }

  const passthrough = process.argv.slice(2).filter((a) => a !== '--');
  const metroUrl = `http://${EXPO_HOST}:${String(EXPO_PORT)}/`;
  const metro = new URL(metroUrl);
  const abort = new AbortController();

  const reuseMetro = await isDevServerRunning(metro);
  let child: ChildProcess | null = null;

  if (reuseMetro) {
    log(
      `Reusing Metro already running at ${metroUrl} (skip expo start — stop the other dev server or run \`bun run --filter @apps/client kill\` to restart).`
    );
  } else {
    child = spawnExpo(passthrough);
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
      process.on(sig, () => {
        abort.abort();
        child?.kill(sig);
      });
    }
    child.on('exit', (code) => {
      abort.abort();
      process.exit(code ?? 0);
    });
  }

  if (!isAutoOpenIosEnabled()) {
    if (reuseMetro) return;
    return;
  }

  try {
    await autoOpenDedicatedSim({
      metroUrl,
      abort: abort.signal,
    });
  } catch (err: unknown) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    log(msg);
    log(
      `Metro keeps running — install manually: bunx expo run:ios --device "${resolveSimName()}"`
    );
  }

  if (reuseMetro) {
    log(
      'Metro reused — press Ctrl+C to exit (Metro keeps running in the other window).'
    );
    await waitForShutdown(abort.signal);
  }
}

void main();
