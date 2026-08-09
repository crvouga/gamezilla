import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import { wallIo } from '@pkgs/io';
import { ensurePodsMatchNodeModules } from './ios-pods';

const io = wallIo();

/**
 * Shared helpers for pinning Expo iOS dev to a project-dedicated simulator
 * and opening the installed `expo-dev-client` against a running Metro server.
 */

/** Must match `expo.ios.bundleIdentifier` in `apps/client/app.json`. */
export const DEV_CLIENT_BUNDLE_ID = 'app.gamezilla';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');

export const SIM_NAME = String(
  process.env['EXPO_DEV_SIM_NAME'] ?? `${APP_IDENTITY.slug}-dev`
);
const SIM_DEVICE_TYPE = String(
  process.env['EXPO_DEV_SIM_DEVICE_TYPE'] ??
    'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro'
);
const SIM_RUNTIME_OVERRIDE =
  process.env['EXPO_DEV_SIM_RUNTIME']?.trim() || null;

type SimDevice = { udid: string; name: string; state: string };
type SimRuntime = {
  identifier: string;
  version: string;
  platform: string;
  isAvailable: boolean;
};

function log(message: string): void {
  process.stderr.write(`[ios-dev] ${message}\n`);
}

function captureJson<T>(cmd: string, args: string[]): T {
  const raw = execFileSync(cmd, args, { encoding: 'utf8' });
  return JSON.parse(raw) as T;
}

function listDevices(): SimDevice[] {
  const json = captureJson<{ devices: Record<string, SimDevice[]> }>('xcrun', [
    'simctl',
    'list',
    'devices',
    'available',
    '--json',
  ]);
  return Object.values(json.devices).flat();
}

function compareVersionDesc(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number(s));
  const pb = b.split('.').map((s) => Number(s));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}

function pickLatestIosRuntime(): string {
  const json = captureJson<{ runtimes: SimRuntime[] }>('xcrun', [
    'simctl',
    'list',
    'runtimes',
    'available',
    '--json',
  ]);
  const ios = json.runtimes.filter(
    (r) => r.platform === 'iOS' && r.isAvailable
  );
  if (ios.length === 0) {
    throw new Error(
      'No available iOS simulator runtimes found. Install one via Xcode → Settings → Platforms.'
    );
  }
  ios.sort((a, b) => compareVersionDesc(a.version, b.version));
  return ios[0]!.identifier;
}

export function provisionDedicatedSim(): string {
  const existing = listDevices().find((d) => d.name === SIM_NAME);
  if (existing !== undefined) {
    log(
      `Reusing simulator "${SIM_NAME}" (${existing.udid}, state=${existing.state}).`
    );
    return existing.udid;
  }
  const runtime = SIM_RUNTIME_OVERRIDE ?? pickLatestIosRuntime();
  log(`Creating simulator "${SIM_NAME}" (${SIM_DEVICE_TYPE} on ${runtime})…`);
  const udid = execFileSync(
    'xcrun',
    ['simctl', 'create', SIM_NAME, SIM_DEVICE_TYPE, runtime],
    { encoding: 'utf8' }
  ).trim();
  log(`Created (${udid}).`);
  return udid;
}

export function bootSimIfNeeded(udid: string): void {
  const dev = listDevices().find((d) => d.udid === udid);
  if (dev?.state === 'Booted') {
    log(`Simulator "${SIM_NAME}" already booted.`);
    return;
  }
  log(`Booting simulator "${SIM_NAME}"…`);
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
    const res = await io.http.fetch(url, { signal });
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
  const deadline = io.clock.now() + timeoutMs;
  while (io.clock.now() < deadline) {
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

export function openDevClientOnSim(udid: string, metroUrl: string): void {
  const url = devClientDeepLink(metroUrl);
  execFileSync('xcrun', ['simctl', 'openurl', udid, url], {
    stdio: 'inherit',
  });
  log(`Opened ${url} on simulator "${SIM_NAME}" (${udid}).`);
}

export interface AutoOpenIosOptions {
  readonly metroUrl: string;
  readonly abort: AbortSignal;
  readonly devServerTimeoutMs?: number;
}

/** Provision sim, ensure dev client, wait for Metro, open deep link. */
export async function autoOpenDedicatedSim(
  options: AutoOpenIosOptions
): Promise<void> {
  if (process.platform !== 'darwin') return;

  const udid = provisionDedicatedSim();

  const metro = new URL(options.metroUrl);
  const timeoutMs = options.devServerTimeoutMs ?? 120_000;

  log(`Waiting for Metro at ${metro.href}…`);
  await waitForDevServer(metro, timeoutMs, options.abort);
  if (options.abort.aborted) return;

  bootSimIfNeeded(udid);
  openSimulatorApp();

  log('Metro is up — ensuring development build is installed…');
  ensureDevClientInstalled(udid, SIM_NAME);

  if (options.abort.aborted) return;
  openDevClientOnSim(udid, metro.href);
}

export function isAutoOpenIosEnabled(): boolean {
  return (
    process.platform === 'darwin' && process.env['EXPO_DEV_AUTO_IOS'] !== '0'
  );
}
