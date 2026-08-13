import {
  captureVersion,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
  whichPath,
  type OsFs,
} from '@pkgs/os';
import { fetchLatestGithubReleaseVersion } from './cli-version-fetch';
import { INFISICAL_CLI_BIN } from './defaults';

const INSTALL_HINT =
  'Install Infisical CLI: brew install infisical/get-cli/infisical';

const homebrewInstaller = new PackageManagerInstaller({
  entries: [
    {
      packageManagerId: 'homebrew',
      package: 'infisical/get-cli/infisical',
      homebrewTap: 'infisical/get-cli',
      // Core formula shares the short name and blocks the tap install.
      homebrewUninstallConflicts: ['infisical'],
    },
  ],
});

function createGithubInstaller(osFs: OsFs | undefined) {
  return new GithubReleaseTarballInstaller({
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
    ...(osFs !== undefined ? { osFs } : {}),
  });
}

function createInstaller(githubInstaller: GithubReleaseTarballInstaller) {
  return new FirstAvailableInstaller(
    [homebrewInstaller, githubInstaller],
    INSTALL_HINT
  );
}

export type SecretBackendCliStatus =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: string };

function isUserLocalBin(binPath: string): boolean {
  return /(^|[\\/])\.local[\\/]bin([\\/]|$)/.test(binPath);
}

/**
 * Infisical CLI install/check surface — implements the tooling dep shape used
 * by infra without exposing Infisical names outside this adapter.
 */
export class InfisicalCliDep {
  readonly name = 'secrets-backend-cli';
  readonly bin = INFISICAL_CLI_BIN;

  constructor(private readonly options: { readonly osFs?: OsFs } = {}) {}

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
    this.installOrUpgrade('install');
  }

  upgrade(): void {
    this.installOrUpgrade('upgrade');
  }

  verify(): void {
    verifyRun(INFISICAL_CLI_BIN, ['--version']);
  }

  private installOrUpgrade(method: 'install' | 'upgrade'): void {
    const path = whichPath(INFISICAL_CLI_BIN);
    const githubInstaller = createGithubInstaller(this.options.osFs);
    // PATH owns a user-local binary — update that (Homebrew would leave it stale).
    if (path !== null && isUserLocalBin(path)) {
      githubInstaller[method]();
      return;
    }
    const installer = createInstaller(githubInstaller);
    installer[method]();
  }
}
