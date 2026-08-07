import { join } from 'node:path';
import { createWritableScriptSecretStore } from '@pkgs/secret-provider';
import type { SecretStore } from '@pkgs/secret-store';
import { createCachingSecretStore } from '@pkgs/secret-store';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/**
 * Secret-store-backed store for Node/Bun CLI scripts. Reads secrets injected by
 * `secrets-run` / CI. Writes go to the configured backend when a bearer
 * token is available (local SECRETS_TOKEN or GitHub OIDC during deploy).
 */
export async function createStripeScriptSecretStore(): Promise<SecretStore> {
  const store = await createWritableScriptSecretStore({
    repoRoot: REPO_ROOT,
  });
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
