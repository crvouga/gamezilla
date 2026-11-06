// @io-wall-ok — interactive login owns the CLI and binds this checkout only.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { loginProject } from '@pkgs/secret-provider-server-ts/login-project';

const repoRoot = join(import.meta.dir, '../../..');
process.exitCode = await loginProject(
  createRepoTreeObjectStore({ rootDir: repoRoot }),
  repoRoot,
  {
    env: process.env,
    run: (args, env) => {
      const result = spawnSync('infisical', [...args], {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      return result.status ?? 1;
    },
  }
);
