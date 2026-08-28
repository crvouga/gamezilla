import { run } from '@pkgs/os';
import { defineCliDep } from './define-cli-dep';
import { REPO_ROOT } from './repo-root';

/** Workspace install — pulls turbo, biome, and other package CLIs into node_modules. */
export const workspaceCliDep = defineCliDep({
  id: 'workspace',
  dependsOn: ['bun'],
  installOrUpgrade() {
    run('bun', ['install'], { cwd: REPO_ROOT });
    console.log('workspace: bun install ok');
  },
});
