/**
 * Run the Expo dev server pinned to a project-dedicated iOS simulator.
 *
 * See `ios-dedicated-sim.ts` for simulator provisioning and dev-client install.
 *
 * Extra argv (`--web`, `--tunnel`, etc.) is forwarded to `expo start`.
 *
 * Configurable via env (all optional):
 *   EXPO_DEV_SIM_NAME         default `<slug>-dev`
 *   EXPO_DEV_SIM_DEVICE_TYPE  default iPhone 17 Pro
 *   EXPO_DEV_SIM_RUNTIME      default: highest-version available iOS runtime
 *   EXPO_DEV_PORT             default 5173
 *   EXPO_DEV_AUTO_IOS         set `0` to skip auto-opening the sim
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoOpenDedicatedSim,
  isAutoOpenIosEnabled,
  SIM_NAME,
} from './ios-dedicated-sim';
import { maybeClearMetroCache } from './metro-dev-cache';

const EXPO_PORT = Number(process.env['EXPO_DEV_PORT'] ?? 5173);
const EXPO_HOST = '127.0.0.1';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
maybeClearMetroCache(clientRoot);
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');

function spawnExpo(passthrough: string[]): ChildProcess {
  const args = ['start', '--port', String(EXPO_PORT), ...passthrough];
  process.stderr.write(`[ios-dev] expo ${args.join(' ')}\n`);
  return spawn(expoBin, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: clientRoot,
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
  const child = spawnExpo(passthrough);

  const abort = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      abort.abort();
      child.kill(sig);
    });
  }
  child.on('exit', (code) => {
    abort.abort();
    process.exit(code ?? 0);
  });

  if (!isAutoOpenIosEnabled()) return;

  const metroUrl = `http://${EXPO_HOST}:${String(EXPO_PORT)}`;
  try {
    await autoOpenDedicatedSim({
      metroUrl,
      abort: abort.signal,
    });
  } catch (err: unknown) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[ios-dev] ${msg}\n`);
    process.stderr.write(
      `[ios-dev] Metro keeps running — install manually: bunx expo run:ios --device "${SIM_NAME}"\n`
    );
  }
}

void main();
