// @io-wall-ok — CLI helper: resolves a token from CI OIDC or the local CLI login.
/**
 * A bearer token for the OpenTofu Infisical provider: GitHub Actions OIDC
 * (the machine identity the secrets-auth action configured) or an explicit
 * token, else the developer's `infisical login` session.
 */

import { join } from 'node:path';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { localSessionToken } from '@pkgs/secret-provider-server-ts/local-session-token';
import { resolveWriteAccessToken } from '@pkgs/secret-provider-server-ts/resolve-write-access-token';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export async function resolveInfisicalToken(): Promise<string> {
  const token = await resolveWriteAccessToken({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    clock: wallClock,
  });
  if (token !== null) return token;

  return localSessionToken(
    createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    REPO_ROOT
  );
}
