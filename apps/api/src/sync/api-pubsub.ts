import type { PubSub } from '@pkgs/pubsub/interface';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx/create-emqx-http-pubsub';
import type { SecretStore } from '@pkgs/secret-store';

import { ApiSecretName } from '../config/secret-names';

let cached: PubSub | null | undefined;

type EmqxHttpCreds = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
};

async function readOptionalSecret(
  secretStore: SecretStore,
  name: string
): Promise<string> {
  const raw = await secretStore.getOptional(name);
  return raw?.readSecretValue()?.trim() ?? '';
}

async function loadEmqxHttpCreds(
  secretStore: SecretStore
): Promise<EmqxHttpCreds | null> {
  const [apiBaseUrl, apiKey, apiSecret] = await Promise.all([
    readOptionalSecret(secretStore, ApiSecretName.emqxApiUrl),
    readOptionalSecret(secretStore, ApiSecretName.emqxApiKey),
    readOptionalSecret(secretStore, ApiSecretName.emqxApiSecret),
  ]);
  if (apiBaseUrl.length === 0) return null;
  if (apiKey.length === 0) return null;
  if (apiSecret.length === 0) return null;
  return { apiBaseUrl, apiKey, apiSecret };
}

/**
 * Lazy Worker-scoped EMQX HTTP publish-only client. Returns undefined when
 * EMQX secrets are unset (nudges disabled; uploads still correct).
 */
export async function getApiPubSub(
  secretStore: SecretStore
): Promise<PubSub | undefined> {
  if (cached !== undefined) {
    return cached === null ? undefined : cached;
  }
  const creds = await loadEmqxHttpCreds(secretStore);
  if (creds === null) {
    cached = null;
    return undefined;
  }
  cached = createEmqxHttpPubSub(creds);
  return cached;
}

/** Test / reset hook. */
export function resetApiPubSubForTests(): void {
  cached = undefined;
}
