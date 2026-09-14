// @io-wall-ok — wall chmod for local secrets cache files (mode 0600).
import { join } from 'node:path';
import { wallOsFs } from '@pkgs/os/wall-os-fs';
import {
  type SecretsCacheEnv,
  secretsCacheFingerprintRelPath,
  secretsCacheMetaRelPath,
  secretsCacheRelPath,
} from './local-secrets-cache';

const SECRET_FILE_MODE = 0o600;

const CACHE_ENVS: readonly SecretsCacheEnv[] = ['dev', 'prd'];

/** Restrict local secrets dump files to owner read/write only. */
export function chmodLocalSecretsCacheFiles(repoRoot: string): void {
  const osFs = wallOsFs();
  const paths = [
    ...CACHE_ENVS.map((env) => join(repoRoot, secretsCacheRelPath(env))),
    join(repoRoot, secretsCacheMetaRelPath()),
    join(repoRoot, secretsCacheFingerprintRelPath()),
  ];
  for (const absolutePath of paths) {
    try {
      osFs.chmodSync(absolutePath, SECRET_FILE_MODE);
    } catch {
      // Missing file (partial pull) — ignore.
    }
  }
}
