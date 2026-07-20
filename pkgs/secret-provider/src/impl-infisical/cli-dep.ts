import {
  captureVersion,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import { fetchLatestGithubReleaseVersion } from './cli-version-fetch';
import { INFISICAL_CLI_BIN } from './defaults';

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
      binName: INFISICAL_CLI_BIN,
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

export type SecretBackendCliStatus =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Infisical CLI install/check surface — implements the tooling dep shape used
 * by infra without exposing Infisical names outside this adapter.
 */
export class InfisicalCliDep {
  readonly name = 'secrets-backend-cli';
  readonly bin = INFISICAL_CLI_BIN;

  version(): string | null {
    return captureVersion(INFISICAL_CLI_BIN, ['--version']);
  }

  check(): SecretBackendCliStatus {
    if (!which(INFISICAL_CLI_BIN)) {
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
    verifyRun(INFISICAL_CLI_BIN, ['--version']);
  }
}
