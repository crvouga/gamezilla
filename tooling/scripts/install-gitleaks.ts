#!/usr/bin/env bun
/**
 * Install a pinned gitleaks release with retries for transient GitHub CDN
 * failures (502/503). CI invokes this instead of curling "latest" on every run.
 *
 * Pin >= 8.25: top-level [[allowlists]] work with [extend].useDefault (8.24.3 bug).
 */
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { accessSync, mkdtempSync, rmSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';

const GITLEAKS_VERSION = process.env['GITLEAKS_VERSION']?.trim() || '8.30.1';
const INSTALL_DIR =
  process.env['GITLEAKS_INSTALL_DIR']?.trim() || '/usr/local/bin';

function resolvePlatform(): string {
  const plat = platform();
  const cpu = arch();
  if (plat === 'linux' && cpu === 'x64') return 'linux_x64';
  if (plat === 'linux' && cpu === 'arm64') return 'linux_arm64';
  if (plat === 'darwin' && cpu === 'arm64') return 'darwin_arm64';
  if (plat === 'darwin' && cpu === 'x64') return 'darwin_x64';
  console.error(`unsupported platform: ${plat}/${cpu}`);
  process.exit(1);
}

function installDirWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadWithCurl(url: string, dest: string): boolean {
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
      '120',
      '-o',
      dest,
      url,
    ],
    { stdio: 'inherit' }
  );
  return r.status === 0;
}

function extractArchive(
  archive: string,
  installDir: string,
  useSudo: boolean
): boolean {
  const tarArgs = ['-xzf', archive, '-C', installDir, 'gitleaks'];
  const r = useSudo
    ? spawnSync('sudo', ['tar', ...tarArgs], { stdio: 'inherit' })
    : spawnSync('tar', tarArgs, { stdio: 'inherit' });
  return r.status === 0;
}

function printInstalledVersion(installDir: string): boolean {
  const r = spawnSync(join(installDir, 'gitleaks'), ['version'], {
    stdio: 'inherit',
  });
  return r.status === 0;
}

async function installGitleaks(): Promise<void> {
  const plat = resolvePlatform();
  const archive = `gitleaks_${GITLEAKS_VERSION}_${plat}.tar.gz`;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${archive}`;
  const useSudo = !installDirWritable(INSTALL_DIR);
  const workdir = mkdtempSync(join(tmpdir(), 'gitleaks-'));
  const archivePath = join(workdir, 'gitleaks.tar.gz');

  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (
        downloadWithCurl(url, archivePath) &&
        extractArchive(archivePath, INSTALL_DIR, useSudo) &&
        printInstalledVersion(INSTALL_DIR)
      ) {
        return;
      }
      console.error(
        `gitleaks install attempt ${attempt}/3 failed; retrying...`
      );
      rmSync(archivePath, { force: true });
      if (attempt < 3) await sleepMs(attempt * 5000);
    }
    console.error('ERROR: gitleaks install failed after 3 attempts');
    process.exit(1);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

await installGitleaks();
