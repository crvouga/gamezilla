// @io-wall-ok — CLI entry: explicit recovery of an abandoned remote state lock.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import { repositoryPolicyEnvironment } from '@libs/infra-shared-ts/repository-policy';
import { initArgs, stackDir } from '@libs/infra-shared-ts/tofu-command';
import { repositoryUnlockArgs } from '@libs/infra-shared-ts/tofu-process-policy';
import { tofu } from './tofu-process';
import { writeResolvedVarFiles } from './tofu-var-files';

const { paths } = tofuLayout(join(import.meta.dirname, '..'));
const args = repositoryUnlockArgs(
  process.env['TOFU_ABANDONED_LOCK_ID'] ?? '',
  paths
);
const { env, missing } = repositoryPolicyEnvironment(process.env, paths);
if (missing.length > 0)
  throw new Error(`Missing credentials: ${missing.join(', ')}`);
mkdirSync(join(paths.cacheDir, 'plugins'), { recursive: true });
writeResolvedVarFiles(paths);
const status = tofu(initArgs(paths, { stack: 'bootstrap', env: null }), env);
if (status !== 0) process.exit(status);
process.exit(tofu([`-chdir=${stackDir(paths, 'bootstrap')}`, ...args], env));
