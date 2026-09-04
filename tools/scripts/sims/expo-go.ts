// @io-wall-ok

import { execFileSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, parse as parsePath } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';
import { isAppInstalled } from './sim-runtime';

export const EXPO_GO_BUNDLE_ID = 'host.exp.Exponent';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

type ExpoVersionsResponse = {
  sdkVersions: Record<
    string,
    {
      iosClientUrl?: string;
    }
  >;
};

function defaultLog(message: string): void {
  process.stderr.write(`[expo-go] ${message}\n`);
}

/**
 * Resolve the Expo SDK major.minor.0 string from a package that depends on
 * `expo` (console / client / root). Prefers the caller's package root when
 * given so workspace installs stay pinned to that app.
 */
export function resolveExpoSdkVersion(packageRoot: string = repoRoot): string {
  const candidates = [
    join(packageRoot, 'node_modules/expo/package.json'),
    join(repoRoot, 'product/console/node_modules/expo/package.json'),
    join(repoRoot, 'apps/client/node_modules/expo/package.json'),
    join(repoRoot, 'node_modules/expo/package.json'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version: string };
    const [major, minor] = pkg.version.split('.');
    return `${major}.${minor}.0`;
  }
  throw new Error(
    'Could not resolve expo package version. Run `bun install` from the repo root.'
  );
}

async function fetchExpoGoDownloadUrl(sdkVersion: string): Promise<string> {
  const res = await globalThis.fetch('https://exp.host/--/api/v2/versions');
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Expo versions (${String(res.status)} ${res.statusText}).`
    );
  }
  const json = (await res.json()) as ExpoVersionsResponse;
  const url = json.sdkVersions[sdkVersion]?.iosClientUrl;
  if (url === undefined || url.length === 0) {
    throw new Error(
      `No Expo Go iOS client for SDK ${sdkVersion}. Update the workspace expo catalog pin.`
    );
  }
  return url;
}

/**
 * Match `@expo/cli` `downloadExpoGoAsync`: `path.parse(url).name + '.app'`.
 * For `Expo-Go-55.0.34.tar.gz` that yields `Expo-Go-55.0.34.tar.app`.
 */
function expoGoCacheAppPath(downloadUrl: string): {
  appPath: string;
  archivePath: string;
} {
  const pathname = new URL(downloadUrl).pathname;
  const parsed = parsePath(pathname);
  const cacheDir = join(homedir(), '.expo', 'ios-simulator-app-cache');
  return {
    appPath: join(cacheDir, `${parsed.name}.app`),
    archivePath: join(cacheDir, parsed.base),
  };
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await globalThis.fetch(url);
  if (!res.ok || res.body === null) {
    throw new Error(
      `Failed to download Expo Go (${String(res.status)} ${res.statusText}).`
    );
  }
  mkdirSync(dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.partial`;
  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as NodeReadableStream),
      createWriteStream(tmpPath)
    );
    rmSync(destPath, { force: true });
    renameSync(tmpPath, destPath);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

function isExpoGoAppBundle(appPath: string): boolean {
  return existsSync(join(appPath, 'Info.plist'));
}

export async function ensureExpoGoAppBundle(
  sdkVersion: string,
  log: (message: string) => void = defaultLog
): Promise<string> {
  const downloadUrl = await fetchExpoGoDownloadUrl(sdkVersion);
  const { appPath, archivePath } = expoGoCacheAppPath(downloadUrl);
  if (isExpoGoAppBundle(appPath)) {
    return appPath;
  }

  log(`Downloading Expo Go for SDK ${sdkVersion}…`);
  await downloadFile(downloadUrl, archivePath);
  rmSync(appPath, { recursive: true, force: true });
  mkdirSync(appPath, { recursive: true });
  // Match @expo/cli: extract archive contents into the `.app` directory.
  execFileSync('tar', ['-xzf', archivePath, '-C', appPath], {
    stdio: 'inherit',
  });
  if (!isExpoGoAppBundle(appPath)) {
    throw new Error(`Expo Go app missing after extract: ${appPath}`);
  }
  return appPath;
}

export async function ensureExpoGoInstalled(
  udid: string,
  sdkVersion: string,
  log: (message: string) => void = defaultLog
): Promise<void> {
  if (isAppInstalled(udid, EXPO_GO_BUNDLE_ID)) {
    log(`Expo Go already installed on ${udid}.`);
    return;
  }
  const appPath = await ensureExpoGoAppBundle(sdkVersion, log);
  log(`Installing Expo Go on simulator (${udid})…`);
  execFileSync('xcrun', ['simctl', 'install', udid, appPath], {
    stdio: 'inherit',
  });
  if (!isAppInstalled(udid, EXPO_GO_BUNDLE_ID)) {
    throw new Error('Expo Go still missing after simctl install.');
  }
  log('Expo Go installed.');
}
