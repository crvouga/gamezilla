// @io-wall-ok — wall chmod for local secrets cache files (mode 0600).
import { join } from 'node:path';
import { wallOsFs } from '@pkgs/os-server-ts/wall-os-fs';
import type { SecretsCacheEnv } from '@pkgs/secret-provider-shared-ts/local-secrets-cache';
import {
  secretsCacheMetaRelPath,
  secretsCacheRelPath,
} from '@pkgs/secret-provider-shared-ts/local-secrets-cache';

const SECRET_FILE_MODE = 0o600;

/** Restrict local secrets dump files (`envs`' maps + meta) to owner read/write only. */
export function chmodLocalSecretsCacheFiles(
  repoRoot: string,
  envs: readonly SecretsCacheEnv[]
): void {
  const osFs = wallOsFs();
  const paths = [
    ...envs.map((env) => join(repoRoot, secretsCacheRelPath(env))),
    join(repoRoot, secretsCacheMetaRelPath()),
  ];
  for (const absolutePath of paths) {
    try {
      osFs.chmodSync(absolutePath, SECRET_FILE_MODE);
    } catch {
      // Missing file (partial pull) — ignore.
    }
  }
}
