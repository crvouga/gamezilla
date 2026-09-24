import {
  FirstAvailableInstaller,
  PackageManagerInstaller,
  which,
} from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';

const INSTALL_HINT =
  'Install GitHub CLI: https://cli.github.com/ (brew install gh)';

const ghInstaller = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'homebrew', package: 'gh' },
        { packageManagerId: 'apt', package: 'gh' },
        { packageManagerId: 'dnf', package: 'gh' },
        { packageManagerId: 'pacman', package: 'github-cli' },
      ],
    }),
  ],
  INSTALL_HINT
);

export const ghCliDep = defineCliDep({
  id: 'gh',
  dependsOn: ['bun'],
  installOrUpgrade() {
    if (!which('gh')) {
      ghInstaller.install();
      logCliVersion('gh', 'gh');
      return;
    }
    // A failed upgrade keeps the installed binary: `brew upgrade` fails hard
    // when Homebrew cannot run (e.g. unsigned Xcode license) even though the
    // existing `gh` is still usable for `bun pr` / deploy / provision.
    try {
      ghInstaller.upgrade();
    } catch (error) {
      console.warn(
        `gh: upgrade failed, keeping the installed version: ${String(error)}`
      );
    }
    logCliVersion('gh', 'gh');
  },
});
