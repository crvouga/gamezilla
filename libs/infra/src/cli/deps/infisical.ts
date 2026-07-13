import {
  captureVersion,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import type { Dep, DepStatus } from './types';
import { fetchLatestGithubReleaseVersion } from './version-fetch';

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
    return fetchLatestGithubReleaseVersion('Infisical/cli', (tag) => {
      const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    });
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
