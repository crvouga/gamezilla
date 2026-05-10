import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

/** Same directory as the Bun installer uses so one PATH entry covers both. */
function dopplerInstallBinDir(): string {
  return join(homedir(), '.bun', 'bin');
}

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function hasHomebrew(): boolean {
  return whichSync('brew');
}

function hasGpg(): boolean {
  return whichSync('gpg');
}

export class DopplerDep implements Dep {
  readonly name = 'doppler';
  readonly bin = 'doppler';

  version(): string | null {
    return captureVersion('doppler', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('doppler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/DopplerHQ/cli/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { tag_name?: string };
      const tag = j.tag_name?.trim() ?? '';
      const m = /^v?([\d.]+(?:\.[\d]+)*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['install', 'dopplerhq/cli/doppler']);
      return;
    }

    const binDir = dopplerInstallBinDir();
    mkdirSync(binDir, { recursive: true });
    const escaped = binDir.replace(/'/g, `'\\''`);

    if (!hasGpg()) {
      spawnInstall('bash', [
        '-c',
        `curl -fsSL https://cli.doppler.com/install.sh | sh -s -- --install-path '${escaped}' --no-verify`,
      ]);
      return;
    }

    spawnInstall('bash', [
      '-c',
      `curl -fsSL https://cli.doppler.com/install.sh | sh -s -- --install-path '${escaped}'`,
    ]);
  }

  upgrade(): void {
    if (
      isMacOS() &&
      hasHomebrew() &&
      !whichSync(join(dopplerInstallBinDir(), 'doppler'))
    ) {
      spawnInstall('brew', ['upgrade', 'dopplerhq/cli/doppler']);
      return;
    }
    spawnInstall('doppler', ['update']);
  }

  verify(): void {
    verifyRun('doppler', ['--version']);
  }
}
