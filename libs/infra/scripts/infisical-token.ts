// @io-wall-ok — CLI helper: resolves a token from CI OIDC or the local CLI login.
/**
 * A bearer token for the OpenTofu Infisical provider: GitHub Actions OIDC
 * (the machine identity the secrets-auth action configured) or an explicit
 * token, else the developer's `infisical login` session.
 */
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { capture } from '@pkgs/os';
import { resolveWriteAccessToken } from '@pkgs/secret-provider/resolve-write-access-token';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export async function resolveInfisicalToken(): Promise<string> {
  const token = await resolveWriteAccessToken({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    clock: wallClock,
  });
  if (token !== null) return token;

  const session = capture('infisical', ['user', 'get', 'token', '--plain']);
  const local = session.stdout.trim();
  if (session.status === 0 && local.length > 0) return local;
  throw new Error(
    'No Infisical token: in CI export SECRETS_IDENTITY_ID (OIDC); locally run `infisical login`.'
  );
}
