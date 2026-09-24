import {
  currentOs,
  GithubReleaseTarballInstaller,
  type Os,
  wallOsFs,
  which,
} from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';

export const GITLEAKS_VERSION =
  process.env['GITLEAKS_VERSION']?.trim() || '8.30.1';

function gitleaksArchivePlat(os: Os): string {
  const cpu = os.releaseArchName() === 'arm64' ? 'arm64' : 'x64';
  if (os.platform === 'darwin') return `darwin_${cpu}`;
  if (os.platform === 'linux') return `linux_${cpu}`;
  throw new Error(`gitleaks: unsupported platform ${os.platform}`);
}

function createGitleaksInstaller(): GithubReleaseTarballInstaller {
  return new GithubReleaseTarballInstaller({
    repo: 'gitleaks/gitleaks',
    binName: 'gitleaks',
    version: GITLEAKS_VERSION,
    archive: (version, os) => ({
      name: `gitleaks_${version}_${gitleaksArchivePlat(os)}.tar.gz`,
      format: 'tar.gz',
    }),
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

/** Install pinned gitleaks if missing (check:secrets fallback). */
export async function ensureGitleaks(): Promise<void> {
  prependLocalBinToPath();
  if (!which('gitleaks')) {
    createGitleaksInstaller().install();
  }
  logCliVersion('gitleaks', 'gitleaks', ['version']);
}

export const gitleaksCliDep = defineCliDep({
  id: 'gitleaks',
  dependsOn: ['bun'],
  async installOrUpgrade() {
    prependLocalBinToPath();
    createGitleaksInstaller().upgrade();
    logCliVersion('gitleaks', 'gitleaks', ['version']);
  },
});
