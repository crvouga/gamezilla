import {
  captureVersion,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import type { Dep, DepStatus } from './types';

const FETCH_TIMEOUT_MS = 15_000;

const INSTALL_HINT =
  'Install Infisical CLI: brew install infisical/get-cli/infisical';

const installer = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        {
          packageManagerId: 'homebrew',
          package: 'infisical/get-cli/infisical',
          homebrewTap: 'infisical/get-cli',
        },
      ],
    }),
    new GithubReleaseTarballInstaller({
      repo: 'Infisical/cli',
      binName: 'infisical',
      archive: (version, os) => {
        const arch = os.releaseArchName() === 'arm64' ? 'arm64' : 'amd64';
        const osName = os.platform === 'darwin' ? 'darwin' : 'linux';
        return {
          name: `cli_${version}_${osName}_${arch}.tar.gz`,
          format: 'tar.gz',
        };
      },
    }),
  ],
  INSTALL_HINT
);

export class InfisicalDep implements Dep {
  readonly name = 'infisical';
  readonly bin = 'infisical';

  version(): string | null {
    return captureVersion('infisical', ['--version']);
  }

  check(): DepStatus {
    if (!which('infisical')) {
      return { ok: false, reason: `not found on PATH — ${INSTALL_HINT}` };
    }
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/Infisical/cli/releases/latest',
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
      const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    installer.install();
  }

  upgrade(): void {
    installer.upgrade();
  }

  verify(): void {
    verifyRun('infisical', ['--version']);
  }
}
