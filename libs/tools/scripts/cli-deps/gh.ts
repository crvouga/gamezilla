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
    // Prefer an existing binary. Forcing brew upgrade fails hard when Homebrew
    // cannot run (e.g. unsigned Xcode license) even though `gh` is already
    // usable for deploy/provision.
    if (which('gh')) {
      logCliVersion('gh', 'gh');
      return;
    }
    ghInstaller.install();
    logCliVersion('gh', 'gh');
  },
});
