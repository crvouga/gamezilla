import { createCachingSecretStore } from '@pkgs/secret-store-shared-ts/caching-secret-store';
import { createEnvSecretStore } from '@pkgs/secret-store-shared-ts/impl-env';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';

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
