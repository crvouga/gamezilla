import type { SecretStore } from '@pkgs/secret-store-shared/interface';
import { createCachingSecretStore } from '@pkgs/secret-store-shared/caching-secret-store';
import { createEnvSecretStore } from '@pkgs/secret-store-shared/impl-env';

/**
 * Worker secrets: all values are injected as env bindings at deploy / setup time.
 */
export function createApiSecretStore(
  env: Readonly<Record<string, string | undefined>>,
  now: () => number
): SecretStore {
  return createCachingSecretStore(createEnvSecretStore(env), {
    ttlMs: 300_000,
    now,
  });
}
