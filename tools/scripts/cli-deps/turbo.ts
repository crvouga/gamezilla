import { join } from 'node:path';
import { run } from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';
import { REPO_ROOT } from './repo-root';

/**
 * Force-upgrade Turborepo to latest (package + lockfile + any codemods).
 * Matches the CLI update banner: `bunx @turbo/codemod@latest update`.
 */
export const turboCliDep = defineCliDep({
  id: 'turbo',
  dependsOn: ['workspace'],
  installOrUpgrade() {
    run('bunx', ['@turbo/codemod@latest', 'update', '--force', '.'], {
      cwd: REPO_ROOT,
    });
    // Codemod may rewrite package.json / catalog — reinstall to sync the lock.
    run('bun', ['install'], { cwd: REPO_ROOT });
    logCliVersion('turbo', join(REPO_ROOT, 'node_modules', '.bin', 'turbo'));
  },
});
