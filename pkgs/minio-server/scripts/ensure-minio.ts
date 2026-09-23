// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Resolve a `minio` binary: MINIO_BIN → matching PATH/Homebrew → cached release.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { MINIO_RELEASE } from '../src/ports';

const APP_DIR = join(import.meta.dirname, '..');
const CACHE_ROOT = join(APP_DIR, '.cache');
// MinIO no longer publishes community binaries; these are the pinned Linux
// release asset digests from easybill/minio-builds.
const LINUX_SHA256: Record<string, string> = {
  'linux-amd64':
    'cd34277b983e38e1d73fc022a8ab3f70e5e1858a727b4dcc92f4683ad52ac5a0',
  'linux-arm64':
    '5bd4c35a9975fb2703173adc36fb1e8ace266453ec8146b3e103236128f006a1',
};

function linuxPlatform(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'linux' && cpu === 'arm64') return 'linux-arm64';
  if (os === 'linux' && cpu === 'x64') return 'linux-amd64';
  throw new Error(
    `Unsupported platform for MinIO binary: ${os}/${cpu}. Set MINIO_BIN.`
  );
}

function matchesPinnedRelease(bin: string): boolean {
  const result = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.includes(MINIO_RELEASE);
}

function whichMinio(): string | null {
  const r = spawnSync('which', ['minio'], { encoding: 'utf8' });
  const path = r.stdout?.trim();
  return r.status === 0 && path && matchesPinnedRelease(path) ? path : null;
}

function brewMinio(): string | null {
  const r = spawnSync('brew', ['--prefix', 'minio'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const prefix = r.stdout?.trim();
  if (!prefix) return null;
  const bin = join(prefix, 'bin', 'minio');
  return existsSync(bin) && matchesPinnedRelease(bin) ? bin : null;
}

function cachedBinPath(): string {
  return join(CACHE_ROOT, MINIO_RELEASE, 'minio');
}

function downloadLinuxMinio(): string {
  const bin = cachedBinPath();
  if (existsSync(bin) && matchesPinnedRelease(bin)) return bin;
  const target = linuxPlatform();
  const expectedHash = LINUX_SHA256[target];
  if (expectedHash === undefined)
    throw new Error(`No MinIO checksum for ${target}`);
  const dir = join(CACHE_ROOT, MINIO_RELEASE);
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/easybill/minio-builds/releases/download/${MINIO_RELEASE}/minio-${target}`;
  process.stdout.write(`[minio] downloading ${url}\n`);
  const r = spawnSync(
    'curl',
    [
      '-fsSL',
      '--retry',
      '5',
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
    if (existsSync(bin)) unlinkSync(bin);
    throw new Error(`Failed to download MinIO from ${url}`);
  }
  const hash = spawnSync('sha256sum', [bin], { encoding: 'utf8' });
  if (hash.status !== 0 || !hash.stdout.startsWith(expectedHash)) {
    unlinkSync(bin);
    throw new Error(`MinIO checksum mismatch for ${target}`);
  }
  chmodSync(bin, 0o755);
  return bin;
}

function fetchHomebrewBottle(): string {
  const bin = cachedBinPath();
  if (existsSync(bin) && matchesPinnedRelease(bin)) return bin;
  const fetched = spawnSync('brew', ['fetch', 'minio'], { stdio: 'inherit' });
  if (fetched.status !== 0) throw new Error('Homebrew could not fetch MinIO');
  const cached = spawnSync('brew', ['--cache', 'minio'], {
    encoding: 'utf8',
  });
  const bottle = cached.stdout.trim();
  if (cached.status !== 0 || !bottle.endsWith('.bottle.1.tar.gz')) {
    throw new Error('Homebrew MinIO bottle not found');
  }
  const dir = join(CACHE_ROOT, MINIO_RELEASE);
  mkdirSync(dir, { recursive: true });
  const version = MINIO_RELEASE.slice('RELEASE.'.length);
  const extracted = spawnSync(
    'tar',
    [
      '-xzf',
      bottle,
      '-C',
      dir,
      '--strip-components=3',
      `minio/${version}/bin/minio`,
    ],
    { stdio: 'inherit' }
  );
  if (extracted.status !== 0 || !matchesPinnedRelease(bin)) {
    if (existsSync(bin)) unlinkSync(bin);
    throw new Error(`Homebrew MinIO bottle does not contain ${MINIO_RELEASE}`);
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
  return platform() === 'darwin' ? fetchHomebrewBottle() : downloadLinuxMinio();
}
