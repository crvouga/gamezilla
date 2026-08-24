import type { PubSub } from '@pkgs/pubsub/interface';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx/create-emqx-http-pubsub';
import type { SecretStore } from '@pkgs/secret-store';

import { PubsubSecretName } from '../../public/secret-names';

export type EmqxHttpPubSubCreds = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
};

/** One-shot factory: EMQX HTTP publish-only client from resolved creds. */
export function createHttpPubSubFromSecretStore(
  creds: EmqxHttpPubSubCreds
): PubSub {
  return createEmqxHttpPubSub(creds);
}

let cached: PubSub | null | undefined;
let injected: PubSub | undefined;

export function setHttpPubSubOverride(pubsub: PubSub | undefined): void {
  injected = pubsub;
  cached = undefined;
}

export function resetHttpPubSubForTests(): void {
  cached = undefined;
  injected = undefined;
}

/** Resolves EMQX HTTP publish credentials and a cached pubsub client. */
export class HttpPubSubFromSecretStore {
  constructor(private readonly secretStore: SecretStore) {}

  async loadCreds(): Promise<EmqxHttpPubSubCreds | null> {
    const [apiBaseUrl, apiKey, apiSecret] = await Promise.all([
      this.readOptionalSecret(PubsubSecretName.apiUrl),
      this.readOptionalSecret(PubsubSecretName.apiKey),
      this.readOptionalSecret(PubsubSecretName.apiSecret),
    ]);
    if (apiBaseUrl.length === 0) return null;
    if (apiKey.length === 0) return null;
    if (apiSecret.length === 0) return null;
    return { apiBaseUrl, apiKey, apiSecret };
  }

  async get(): Promise<PubSub | undefined> {
    if (injected !== undefined) {
      return injected;
    }
    if (cached !== undefined) {
      return cached === null ? undefined : cached;
    }
    const creds = await this.loadCreds();
    if (creds === null) {
      cached = null;
      return undefined;
    }
    cached = createHttpPubSubFromSecretStore(creds);
    return cached;
  }

  private async readOptionalSecret(name: string): Promise<string> {
    const raw = await this.secretStore.getOptional(name);
    return raw?.readSecretValue()?.trim() ?? '';
  }
}
