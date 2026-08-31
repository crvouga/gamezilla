// @io-wall-ok

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { SIM_PROJECT_SLUG } from '../../../tools/scripts/sims/sim-project';
import {
  bootSimIfNeeded,
  isAppInstalled,
  openSimulatorApp,
  openUrlOnSim,
  resolveProjectSim,
} from '../../../tools/scripts/sims/sim-runtime';
import type { SimSpecId } from '../../../tools/scripts/sims/sim-spec';

const EXPO_GO_BUNDLE_ID = 'host.exp.Exponent';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const consoleRoot = join(scriptDir, '..');

function log(message: string): void {
  process.stderr.write(`[expo-go-ios] ${message}\n`);
}

function expoSdkVersion(): string {
  const pkg = require(join(consoleRoot, 'node_modules/expo/package.json')) as {
    version: string;
  };
  const [major, minor] = pkg.version.split('.');
  return `${major}.${minor}.0`;
}

type ExpoVersionsResponse = {
  sdkVersions: Record<
    string,
    {
      iosClientUrl?: string;
    }
  >;
};

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
      `No Expo Go iOS client for SDK ${sdkVersion}. Update expo in @sim/console.`
    );
  }
  return url;
}

function expoGoCacheAppPath(downloadUrl: string): {
  appPath: string;
  archivePath: string;
} {
  const archiveName = basename(new URL(downloadUrl).pathname);
  const baseName = archiveName.replace(/\.tar\.gz$/i, '');
  const cacheDir = join(homedir(), '.expo', 'ios-simulator-app-cache');
  return {
    appPath: join(cacheDir, `${baseName}.app`),
    archivePath: join(cacheDir, archiveName),
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
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

async function ensureExpoGoAppBundle(sdkVersion: string): Promise<string> {
  const downloadUrl = await fetchExpoGoDownloadUrl(sdkVersion);
  const { appPath, archivePath } = expoGoCacheAppPath(downloadUrl);
  if (existsSync(appPath)) {
    return appPath;
  }

  log(`Downloading Expo Go for SDK ${sdkVersion}…`);
  await downloadFile(downloadUrl, archivePath);
  execFileSync('tar', ['-xzf', archivePath, '-C', dirname(appPath)], {
    stdio: 'inherit',
  });
  if (!existsSync(appPath)) {
    throw new Error(`Expo Go app missing after extract: ${appPath}`);
  }
  return appPath;
}

export async function ensureExpoGoInstalled(
  udid: string,
  sdkVersion: string
): Promise<void> {
  if (isAppInstalled(udid, EXPO_GO_BUNDLE_ID)) {
    return;
  }
  const appPath = await ensureExpoGoAppBundle(sdkVersion);
  log(`Installing Expo Go on simulator (${udid})…`);
  execFileSync('xcrun', ['simctl', 'install', udid, appPath], {
    stdio: 'inherit',
  });
  if (!isAppInstalled(udid, EXPO_GO_BUNDLE_ID)) {
    throw new Error('Expo Go still missing after simctl install.');
  }
  log('Expo Go installed.');
}

export async function openExpoGoOnProjectSim(
  simId: SimSpecId,
  metroPort: number
): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Expo Go on iOS Simulator requires macOS.');
  }

  const { udid, name } = resolveProjectSim(simId);
  bootSimIfNeeded(udid, name, log);
  openSimulatorApp();

  const sdkVersion = expoSdkVersion();
  await ensureExpoGoInstalled(udid, sdkVersion);

  const metroUrl = `exp://127.0.0.1:${String(metroPort)}`;
  openUrlOnSim(udid, metroUrl);
  log(
    `Opened ${metroUrl} on "${name}" (${SIM_PROJECT_SLUG} ${simId}, ${udid}).`
  );
}
