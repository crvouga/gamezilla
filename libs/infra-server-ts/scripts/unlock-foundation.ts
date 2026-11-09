// @io-wall-ok — CLI entry: explicit recovery of an abandoned foundation state lock.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import { foundationUnlockEnvironment } from '@libs/infra-shared-ts/foundation-unlock';
import { initArgs, stackDir } from '@libs/infra-shared-ts/tofu-command';
import { stateUnlockArgs } from '@libs/infra-shared-ts/tofu-process-policy';
import { tofu } from './tofu-process';
import { writeResolvedVarFiles } from './tofu-var-files';

const { paths } = tofuLayout(join(import.meta.dirname, '..'));
const envName = (process.env['SECRETS_ENV'] ?? '').trim();
if (envName.length === 0) throw new Error('SECRETS_ENV is required');
const target = { stack: 'foundation' as const, env: envName };
const args = stateUnlockArgs(
  process.env['TOFU_ABANDONED_LOCK_ID'] ?? '',
  paths,
  target
);
const { env, missing } = foundationUnlockEnvironment(
  process.env,
  paths,
  envName
);
if (missing.length > 0)
  throw new Error(`Missing credentials: ${missing.join(', ')}`);
mkdirSync(join(paths.cacheDir, 'plugins'), { recursive: true });
writeResolvedVarFiles(paths);
const status = tofu(initArgs(paths, target), env);
if (status !== 0) process.exit(status);
process.exit(tofu([`-chdir=${stackDir(paths, 'foundation')}`, ...args], env));
