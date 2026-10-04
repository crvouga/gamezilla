import type { SecretStore } from './interface';
import {
  createRecordSecretStore,
} from './record-secret-store';

/**
 * Runtime {@link SecretStore} backed by injected env bindings. The Worker,
 * scripts under `secrets-run`, and tests use this — no network, no provider.
 */
export function createEnvSecretStore(
  env: Readonly<Record<string, string | undefined>>
): SecretStore {
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(env)) {
    if (typeof raw === 'string') {
      values[key] = raw;
    }
  }
  return createRecordSecretStore(values);
}
