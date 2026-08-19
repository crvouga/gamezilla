// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMQX_VERSION } from '../src/ports';

const APP_DIR = join(import.meta.dirname, '..');
const CACHE_ROOT = join(APP_DIR, '.cache');

type EmqxAsset = {
  readonly dir: string;
  readonly url: string;
  readonly archive: 'tar.gz' | 'zip';
};

function resolveAsset(): EmqxAsset {
  const plat = platform();
  const cpu = arch();
  // GitHub release asset names (v5.8.x): macos uses .zip; linux uses .tar.gz.
  let suffix: string;
  let archive: EmqxAsset['archive'];
  if (plat === 'darwin' && cpu === 'arm64') {
    suffix = 'macos14-arm64';
    archive = 'zip';
  } else if (plat === 'darwin' && cpu === 'x64') {
    suffix = 'macos13-amd64';
    archive = 'zip';
  } else if (plat === 'linux' && cpu === 'arm64') {
    suffix = 'ubuntu22.04-arm64';
    archive = 'tar.gz';
  } else if (plat === 'linux' && cpu === 'x64') {
    suffix = 'ubuntu22.04-amd64';
    archive = 'tar.gz';
  } else {
    throw new Error(
      `Unsupported platform for EMQX tarball: ${plat}/${cpu}. Install via brew or set EMQX_BIN.`
    );
  }
  const dirName = `emqx-${EMQX_VERSION}-${suffix}`;
  return {
    dir: dirName,
    archive,
    url: `https://github.com/emqx/emqx/releases/download/v${EMQX_VERSION}/${dirName}.${archive}`,
  };
}

function whichEmqx(): string | null {
  const r = spawnSync('which', ['emqx'], { encoding: 'utf8' });
  const path = r.stdout?.trim();
  return r.status === 0 && path ? path : null;
}

function brewEmqx(): string | null {
  const r = spawnSync('brew', ['--prefix', 'emqx'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const prefix = r.stdout?.trim();
  if (!prefix) return null;
  const bin = join(prefix, 'bin', 'emqx');
  return existsSync(bin) ? bin : null;
}

function downloadTarball(url: string, dest: string): void {
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
      dest,
      url,
    ],
    { stdio: 'inherit' }
  );
  if (r.status !== 0) {
    throw new Error(`Failed to download EMQX from ${url}`);
  }
}

function extractArchive(
  kind: EmqxAsset['archive'],
  archivePath: string,
  destDir: string
): void {
  const extract =
    kind === 'zip'
      ? spawnSync('unzip', ['-q', archivePath, '-d', destDir], {
          stdio: 'inherit',
        })
      : spawnSync('tar', ['-xzf', archivePath, '-C', destDir], {
          stdio: 'inherit',
        });
  if (extract.status !== 0) {
    throw new Error(`Failed to extract EMQX ${kind} archive`);
  }
}

function ensureTarballEmqx(): string {
  const { dir, url, archive: kind } = resolveAsset();
  const installRoot = join(CACHE_ROOT, dir);
  const bin = join(installRoot, 'bin', 'emqx');
  if (existsSync(bin)) return bin;

  mkdirSync(CACHE_ROOT, { recursive: true });
  const archivePath = join(tmpdir(), `${dir}.${kind}`);
  const extractTmp = join(CACHE_ROOT, `.tmp-${dir}`);
  rmSync(extractTmp, { recursive: true, force: true });
  mkdirSync(extractTmp, { recursive: true });

  console.warn(`[emqx] downloading ${url}`);
  downloadTarball(url, archivePath);
  extractArchive(kind, archivePath, extractTmp);

  // Linux .tar.gz usually has one top-level dir; macOS .zip is flat (bin/, etc/).
  const entries = readdirSync(extractTmp).filter((n) => !n.startsWith('.'));
  if (entries.length === 0) throw new Error('EMQX archive extract was empty');
  const nestedRoot = join(extractTmp, entries[0]!);
  const unpacked =
    entries.length === 1 && existsSync(join(nestedRoot, 'bin', 'emqx'))
      ? nestedRoot
      : existsSync(join(extractTmp, 'bin', 'emqx'))
        ? extractTmp
        : null;
  if (!unpacked) {
    throw new Error('EMQX archive missing bin/emqx after extract');
  }
  rmSync(installRoot, { recursive: true, force: true });
  if (unpacked === extractTmp) {
    renameSync(extractTmp, installRoot);
  } else {
    renameSync(unpacked, installRoot);
    rmSync(extractTmp, { recursive: true, force: true });
  }
  chmodSync(bin, 0o755);
  return bin;
}

/** Resolve an `emqx` binary path (PATH / brew / cached tarball). */
export function ensureEmqxBin(): string {
  const fromEnv = process.env['EMQX_BIN']?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`EMQX_BIN not found: ${fromEnv}`);
    }
    return fromEnv;
  }
  const fromPath = whichEmqx();
  if (fromPath) return fromPath;
  const fromBrew = brewEmqx();
  if (fromBrew) return fromBrew;
  return ensureTarballEmqx();
}
