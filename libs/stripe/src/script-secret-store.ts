import {
  createCachingSecretStore,
  createWritableScriptSecretStore,
} from '@pkgs/secret-store';
import type { SecretStore } from '@pkgs/secret-store';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/**
 * Infisical-backed store for Node/Bun CLI scripts. Reads secrets injected by
 * `secrets-run` / CI / `infisical run`. Writes go to Infisical when a bearer
 * token is available (local SECRETS_TOKEN or GitHub OIDC during deploy).
 */
export async function createStripeScriptSecretStore(): Promise<SecretStore> {
  const store = await createWritableScriptSecretStore({
    repoRoot: REPO_ROOT,
  });
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}
