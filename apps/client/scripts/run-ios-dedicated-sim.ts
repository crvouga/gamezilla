/**
 * Run the Expo dev server pinned to a project-dedicated iOS simulator.
 *
 * Why this script exists:
 *   `expo start --ios` has no `--device` flag. When multiple simulators are
 *   booted (because another Expo project — e.g. `Geviti-Dev` — is running in
 *   parallel), Expo's `getBestBootedSimulatorAsync` returns the *first*
 *   booted sim, which is non-deterministic. To run two Expo projects side by
 *   side without fighting over the same simulator window, each project pins
 *   its own named sim.
 *
 * What it does:
 *   1. Find (or `simctl create`) a simulator named `<slug>-dev`.
 *   2. Boot it if not already booted (other booted sims are left alone).
 *   3. Foreground `Simulator.app` (no `--CurrentDeviceUDID` arg so multiple
 *      windows stay visible).
 *   4. Spawn `expo start --port 5173 --clear` (no `--ios` — we open the URL
 *      ourselves so Expo can't pick the wrong sim).
 *   5. Wait for the Metro dev server to respond, then open the
 *      `expo-development-client` deep link against our sim so the installed
 *      dev client (not Expo Go) loads the Metro bundle.
 *
 * Requires the development build (`expo-dev-client`) to already be installed
 * on the simulator. Build + install it once with EAS:
 *   `bunx eas-cli build --profile development-simulator --platform ios`
 *   `bunx eas-cli build:run --profile development-simulator --platform ios`
 * (or `bunx expo run:ios --device "<slug>-dev"` for a local Xcode build).
 *
 * Extra argv (`--web`, `--tunnel`, etc.) is forwarded to `expo start`.
 *
 * Configurable via env (all optional):
 *   EXPO_DEV_SIM_NAME         default `<slug>-dev`
 *   EXPO_DEV_SIM_DEVICE_TYPE  default iPhone 17 Pro
 *   EXPO_DEV_SIM_RUNTIME      default: highest-version available iOS runtime
 *   EXPO_DEV_PORT             default 5173
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';

/**
 * Native bundle id of the development build. Must match
 * `expo.ios.bundleIdentifier` in `apps/client/app.json` (Expo requires static
 * JSON there, so it cannot import this value).
 */
const DEV_CLIENT_BUNDLE_ID = 'app.gamezilla';

const SIM_NAME = process.env['EXPO_DEV_SIM_NAME'] ?? `${APP_IDENTITY.slug}-dev`;
const SIM_DEVICE_TYPE =
  process.env['EXPO_DEV_SIM_DEVICE_TYPE'] ??
  'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro';
const SIM_RUNTIME_OVERRIDE = process.env['EXPO_DEV_SIM_RUNTIME'] ?? null;
const EXPO_PORT = Number(process.env['EXPO_DEV_PORT'] ?? 5173);
const EXPO_HOST = '127.0.0.1';
const DEV_SERVER_TIMEOUT_MS = 60_000;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');

type SimDevice = { udid: string; name: string; state: string };
type SimRuntime = {
  identifier: string;
  version: string;
  platform: string;
  isAvailable: boolean;
};

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

function provisionSim(): string {
  const existing = listDevices().find((d) => d.name === SIM_NAME);
  if (existing !== undefined) {
    process.stdout.write(
      `[ios-dev] Reusing simulator "${SIM_NAME}" (${existing.udid}, state=${existing.state}).\n`
    );
    return existing.udid;
  }
  const runtime = SIM_RUNTIME_OVERRIDE ?? pickLatestIosRuntime();
  process.stdout.write(
    `[ios-dev] Creating simulator "${SIM_NAME}" (${SIM_DEVICE_TYPE} on ${runtime})…\n`
  );
  const udid = execFileSync(
    'xcrun',
    ['simctl', 'create', SIM_NAME, SIM_DEVICE_TYPE, runtime],
    { encoding: 'utf8' }
  ).trim();
  process.stdout.write(`[ios-dev] Created (${udid}).\n`);
  return udid;
}

function bootIfNeeded(udid: string): void {
  const dev = listDevices().find((d) => d.udid === udid);
  if (dev?.state === 'Booted') {
    process.stdout.write(`[ios-dev] Simulator "${SIM_NAME}" already booted.\n`);
    return;
  }
  process.stdout.write(`[ios-dev] Booting simulator "${SIM_NAME}"…\n`);
  try {
    execFileSync('xcrun', ['simctl', 'boot', udid], { stdio: 'inherit' });
  } catch (err: unknown) {
    // Tolerate the "Unable to boot device in current state: Booted" race.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Booted/i.test(msg)) throw err;
  }
}

function openSimulatorApp(): void {
  // No `--args -CurrentDeviceUDID <UDID>` so sibling project simulators (e.g.
  // `Geviti-Dev`) stay visible in the window list.
  try {
    execFileSync('open', ['-a', 'Simulator'], { stdio: 'inherit' });
  } catch {
    // Non-fatal — Simulator.app may already be running.
  }
}

async function pingDevServer(url: URL, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { signal });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function waitForDevServer(
  url: URL,
  timeoutMs: number,
  abort: AbortSignal
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (abort.aborted) return;
    const probe = AbortSignal.any([abort, AbortSignal.timeout(1500)]);
    if (await pingDevServer(url, probe)) return;
    await sleep(500);
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${url.href}; did the dev server fail to start?`
  );
}

function isDevClientInstalled(udid: string): boolean {
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

function ensureDevClientInstalled(udid: string): boolean {
  if (isDevClientInstalled(udid)) return true;
  process.stderr.write(
    `[ios-dev] The development build (${DEV_CLIENT_BUNDLE_ID}) is not installed on "${SIM_NAME}".\n` +
      '[ios-dev] Build + install it once, then re-run this script:\n' +
      '[ios-dev]   bunx eas-cli build --profile development-simulator --platform ios\n' +
      '[ios-dev]   bunx eas-cli build:run --profile development-simulator --platform ios\n' +
      '[ios-dev] (or `bunx expo run:ios` for a local Xcode build).\n'
  );
  return false;
}

/**
 * Dev-client deep link that tells the installed development build to load the
 * Metro bundle from our pinned dev server, e.g.
 * `gamezilla://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A5173`.
 */
function devClientUrl(metroUrl: string): string {
  return `${APP_IDENTITY.urlScheme}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
}

function openOnSim(udid: string, url: string): void {
  if (!ensureDevClientInstalled(udid)) return;
  try {
    execFileSync('xcrun', ['simctl', 'openurl', udid, url], {
      stdio: 'inherit',
    });
    process.stdout.write(
      `[ios-dev] Opened ${url} on simulator "${SIM_NAME}" (${udid}).\n`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[ios-dev] simctl openurl failed: ${msg}\n`);
  }
}

function spawnExpo(passthrough: string[]): ChildProcess {
  const args = [
    'start',
    '--port',
    String(EXPO_PORT),
    '--clear',
    ...passthrough,
  ];
  process.stdout.write(`[ios-dev] expo ${args.join(' ')}\n`);
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

  const udid = provisionSim();
  bootIfNeeded(udid);
  openSimulatorApp();

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

  const devServerUrl = new URL(`http://${EXPO_HOST}:${EXPO_PORT}`);
  try {
    await waitForDevServer(devServerUrl, DEV_SERVER_TIMEOUT_MS, abort.signal);
    openOnSim(udid, devClientUrl(devServerUrl.href));
  } catch (err: unknown) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[ios-dev] ${msg}\n`);
  }
}

void main();
