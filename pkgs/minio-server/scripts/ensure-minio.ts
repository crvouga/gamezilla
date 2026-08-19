// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Resolve a `minio` binary: MINIO_BIN → PATH → Homebrew → cached download.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { MINIO_RELEASE } from '../src/ports';

const APP_DIR = join(import.meta.dirname, '..');
const CACHE_ROOT = join(APP_DIR, '.cache');

function platformDir(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'darwin' && cpu === 'arm64') return 'darwin-arm64';
  if (os === 'darwin' && cpu === 'x64') return 'darwin-amd64';
  if (os === 'linux' && cpu === 'arm64') return 'linux-arm64';
  if (os === 'linux' && cpu === 'x64') return 'linux-amd64';
  throw new Error(
    `Unsupported platform for MinIO binary: ${os}/${cpu}. Install via brew or set MINIO_BIN.`
  );
}

function whichMinio(): string | null {
  const r = spawnSync('which', ['minio'], { encoding: 'utf8' });
  const path = r.stdout?.trim();
  return r.status === 0 && path ? path : null;
}

function brewMinio(): string | null {
  const r = spawnSync('brew', ['--prefix', 'minio'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const prefix = r.stdout?.trim();
  if (!prefix) return null;
  const bin = join(prefix, 'bin', 'minio');
  return existsSync(bin) ? bin : null;
}

function cachedBinPath(): string {
  return join(CACHE_ROOT, MINIO_RELEASE, 'minio');
}

function downloadCachedMinio(): string {
  const bin = cachedBinPath();
  if (existsSync(bin)) return bin;

  const dir = join(CACHE_ROOT, MINIO_RELEASE);
  mkdirSync(dir, { recursive: true });
  const url = `https://dl.min.io/server/minio/release/${platformDir()}/archive/minio.${MINIO_RELEASE}`;
  process.stdout.write(`[minio] downloading ${url}\n`);
  const r = spawnSync(
    'curl',
    [
      '-fsSL',
      '--retry',
      '5',
      '--retry-all-errors',
      '--connect-timeout',
      '10',
      '--max-time',
      '300',
      '-o',
      bin,
      url,
    ],
    { stdio: 'inherit' }
  );
  if (r.status !== 0) {
    throw new Error(`Failed to download MinIO from ${url}`);
  }
  chmodSync(bin, 0o755);
  return bin;
}

/** Resolve a `minio` binary path (PATH / brew / cached download). */
export function ensureMinioBin(): string {
  const fromEnv = process.env['MINIO_BIN']?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`MINIO_BIN not found: ${fromEnv}`);
    }
    return fromEnv;
  }
  const fromPath = whichMinio();
  if (fromPath) return fromPath;
  const fromBrew = brewMinio();
  if (fromBrew) return fromBrew;
  return downloadCachedMinio();
}
