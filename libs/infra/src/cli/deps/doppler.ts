import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  captureVersion,
  CurlScriptInstaller,
  FirstAvailableInstaller,
  PackageManagerInstaller,
  run,
  verifyRun,
  which,
} from '@pkgs/os';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

/** Same directory as the Bun installer uses so one PATH entry covers both. */
function dopplerInstallBinDir(): string {
  return join(homedir(), '.bun', 'bin');
}

function buildInstaller(): FirstAvailableInstaller {
  const binDir = dopplerInstallBinDir();
  mkdirSync(binDir, { recursive: true });
  const scriptArgs: string[] = ['--install-path', binDir];
  if (!which('gpg')) scriptArgs.push('--no-verify');
  return new FirstAvailableInstaller(
    [
      new PackageManagerInstaller({
        entries: [
          {
            packageManagerId: 'homebrew',
            package: 'dopplerhq/cli/doppler',
          },
          { packageManagerId: 'scoop', package: 'doppler' },
          { packageManagerId: 'winget', package: 'Doppler.Doppler' },
        ],
      }),
      new CurlScriptInstaller({
        url: 'https://cli.doppler.com/install.sh',
        shell: 'sh',
        scriptArgs,
      }),
    ],
    'Install Doppler CLI manually: https://docs.doppler.com/docs/install-cli'
  );
}

export class DopplerDep implements Dep {
  readonly name = 'doppler';
  readonly bin = 'doppler';

  version(): string | null {
    return captureVersion('doppler', ['--version']);
  }

  check(): DepStatus {
    if (!which('doppler')) return { ok: false, reason: 'not found on PATH' };
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
    buildInstaller().install();
  }

  upgrade(): void {
    if (which('doppler')) {
      // `doppler update` is the in-place self-updater. It refuses to operate
      // on Homebrew-managed installs (it knows when it can't update itself),
      // so callers fall through to the PM-based installer in that case.
      try {
        run('doppler', ['update']);
        return;
      } catch {
        // fall through
      }
    }
    buildInstaller().upgrade();
  }

  verify(): void {
    verifyRun('doppler', ['--version']);
  }
}
