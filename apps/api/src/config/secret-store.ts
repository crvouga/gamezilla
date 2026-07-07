import type { SecretStore } from '@pkgs/secret-store';
import {
  createCachingSecretStore,
  createEnvSecretStore,
} from '@pkgs/secret-store';

/**
 * Worker secrets: all values are injected as env bindings at deploy / setup time.
 */
export function createApiSecretStore(
  env: Readonly<Record<string, string | undefined>>
): SecretStore {
  return createCachingSecretStore(createEnvSecretStore(env), {
    ttlMs: 300_000,
  });
}
