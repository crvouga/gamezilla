// @io-wall-ok

import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { wallClock } from '@pkgs/clock';
import { simSpecById } from '../../../tools/scripts/sims/sim-spec';
import {
  findDeviceByName,
  listDevices,
} from '../../../tools/scripts/sims/simctl';
import { ensurePodsMatchNodeModules } from './ios-pods';

/**
 * Open the product `expo-dev-client` on the simulator provisioned by
 * `bun setup:sims` (SIM_SPEC id `iphone`).
 */

/** Must match `expo.ios.bundleIdentifier` in `apps/client/app.json`. */
export const DEV_CLIENT_BUNDLE_ID = 'app.gamezilla';

const CLIENT_IOS_SIM_ID = 'iphone' as const;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');

function log(message: string): void {
  process.stderr.write(`[ios-dev] ${message}\n`);
}

/** Display name from SIM_SPEC for the product iPhone simulator. */
export function resolveSimName(): string {
  return simSpecById(CLIENT_IOS_SIM_ID).name;
}

export function resolveDedicatedSim(): { udid: string; name: string } {
  const spec = simSpecById(CLIENT_IOS_SIM_ID);
  const existing = findDeviceByName(spec.name);
  if (existing === undefined) {
    throw new Error(
      `Simulator "${spec.name}" is missing. Run \`bun setup:sims\` first.`
    );
  }
  log(
    `Using simulator "${spec.name}" (${existing.udid}, state=${existing.state}).`
  );
  return { udid: existing.udid, name: spec.name };
}

export function bootSimIfNeeded(udid: string, simName: string): void {
  const dev = listDevices().find((d) => d.udid === udid);
  if (dev?.state === 'Booted') {
    log(`Simulator "${simName}" already booted.`);
    return;
  }
  log(`Booting simulator "${simName}"…`);
  try {
    execFileSync('xcrun', ['simctl', 'boot', udid], { stdio: 'inherit' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Booted/i.test(msg)) throw err;
  }
}

export function openSimulatorApp(): void {
  try {
    execFileSync('open', ['-a', 'Simulator'], { stdio: 'inherit' });
  } catch {
    // Non-fatal — Simulator.app may already be running.
  }
}

async function pingDevServer(url: URL, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await globalThis.fetch(url, { signal });
    return res.status > 0;
  } catch {
    return false;
  }
}

/**
 * True when Metro (or any HTTP server) responds on `url`.
 *
 * Retried, because a live-but-busy Metro (mid-bundle) can miss a single short
 * probe. A false negative is expensive: the caller then starts its own
 * `expo start`, which finds the port already bound and — being non-interactive —
 * exits rather than prompting for a different port, taking the whole run down.
 */
export async function isDevServerRunning(url: URL): Promise<boolean> {
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await pingDevServer(url, AbortSignal.timeout(3000))) return true;
    if (attempt < attempts - 1) await sleep(500);
  }
  return false;
}

export async function waitForDevServer(
  url: URL,
  timeoutMs: number,
  abort: AbortSignal
): Promise<void> {
  const deadline = wallClock.now() + timeoutMs;
  while (wallClock.now() < deadline) {
    if (abort.aborted) return;
    const probe = AbortSignal.any([abort, AbortSignal.timeout(1500)]);
    if (await pingDevServer(url, probe)) return;
    await sleep(500);
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${url.href}; did Metro fail to start?`
  );
}

export function isDevClientInstalled(udid: string): boolean {
  try {
    execFileSync(
      'xcrun',
      ['simctl', 'get_app_container', udid, DEV_CLIENT_BUNDLE_ID],
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

export function installDevClientOnSim(simName: string): void {
  ensurePodsMatchNodeModules(clientRoot);
  log(
    `Installing development build (${DEV_CLIENT_BUNDLE_ID}) on "${simName}" — first run may take several minutes…`
  );
  const result = spawnSync(
    expoBin,
    ['run:ios', '--device', simName, '--no-bundler'],
    {
      cwd: clientRoot,
      env: process.env,
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `expo run:ios exited with code ${String(result.status ?? 1)}`
    );
  }
}

export function ensureDevClientInstalled(udid: string, simName: string): void {
  if (isDevClientInstalled(udid)) {
    log(`Development build already installed on "${simName}".`);
    return;
  }
  installDevClientOnSim(simName);
  if (!isDevClientInstalled(udid)) {
    throw new Error(
      `Development build (${DEV_CLIENT_BUNDLE_ID}) still missing after expo run:ios.`
    );
  }
  log(`Development build installed on "${simName}".`);
}

export function devClientDeepLink(metroUrl: string): string {
  return `${APP_IDENTITY.urlScheme}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
}

export function openDevClientOnSim(
  udid: string,
  metroUrl: string,
  simName: string
): void {
  const url = devClientDeepLink(metroUrl);
  execFileSync('xcrun', ['simctl', 'openurl', udid, url], {
    stdio: 'inherit',
  });
  log(`Opened ${url} on simulator "${simName}" (${udid}).`);
}

export interface AutoOpenIosOptions {
  readonly metroUrl: string;
  readonly abort: AbortSignal;
  readonly devServerTimeoutMs?: number;
}

/** Resolve sim from SIM_SPEC, ensure dev client, wait for Metro, open deep link. */
export async function autoOpenDedicatedSim(
  options: AutoOpenIosOptions
): Promise<void> {
  if (process.platform !== 'darwin') return;

  const { udid, name } = resolveDedicatedSim();

  const metro = new URL(options.metroUrl);
  const timeoutMs = options.devServerTimeoutMs ?? 120_000;

  log(`Waiting for Metro at ${metro.href}…`);
  await waitForDevServer(metro, timeoutMs, options.abort);
  if (options.abort.aborted) return;

  bootSimIfNeeded(udid, name);
  openSimulatorApp();

  log('Metro is up — ensuring development build is installed…');
  ensureDevClientInstalled(udid, name);

  if (options.abort.aborted) return;
  openDevClientOnSim(udid, metro.href, name);
}

export function isAutoOpenIosEnabled(): boolean {
  return (
    process.platform === 'darwin' && process.env['EXPO_DEV_AUTO_IOS'] !== '0'
  );
}
