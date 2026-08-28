import {
  currentOs,
  GithubReleaseTarballInstaller,
  wallOsFs,
  which,
} from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';

export const ACTIONLINT_VERSION = '1.7.7';

function createActionlintInstaller(): GithubReleaseTarballInstaller {
  return new GithubReleaseTarballInstaller({
    repo: 'rhysd/actionlint',
    binName: 'actionlint',
    version: ACTIONLINT_VERSION,
    archive: (version, os) => {
      const plat = os.platform === 'darwin' ? 'darwin' : 'linux';
      const arch = os.releaseArchName() === 'arm64' ? 'arm64' : 'amd64';
      return {
        name: `actionlint_${version}_${plat}_${arch}.tar.gz`,
        format: 'tar.gz',
      };
    },
    osFs: wallOsFs(),
  });
}

function prependLocalBinToPath(): void {
  const binDir = currentOs().defaultBinDir();
  const path = process.env['PATH'] ?? '';
  if (!path.includes(binDir)) {
    process.env['PATH'] = `${binDir}:${path}`;
  }
}

/** Install pinned actionlint if missing (check:static fallback). */
export async function ensureActionlint(): Promise<void> {
  prependLocalBinToPath();
  if (!which('actionlint')) {
    createActionlintInstaller().install();
  }
  logCliVersion('actionlint', 'actionlint', ['-version']);
}

export const actionlintCliDep = defineCliDep({
  id: 'actionlint',
  dependsOn: ['bun'],
  async installOrUpgrade() {
    prependLocalBinToPath();
    createActionlintInstaller().upgrade();
    logCliVersion('actionlint', 'actionlint', ['-version']);
  },
});
