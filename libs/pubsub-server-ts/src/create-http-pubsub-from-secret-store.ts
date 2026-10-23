import { PubsubSecretName } from '@libs/pubsub-shared-ts/secret-names';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx-shared-ts/create-emqx-http-pubsub';
import { createIotHttpPubSub } from '@pkgs/pubsub-root-shared-ts/create-iot-http-pubsub';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';

export type EmqxHttpPubSubCreds = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
};

export type IotHttpPubSubCreds = {
  readonly endpoint: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly now: () => number;
};

type Resolved =
  | {
      readonly kind: 'iot';
      readonly endpoint: string;
      readonly accessKeyId: string;
      readonly secretAccessKey: string;
      readonly region: string;
    }
  | (EmqxHttpPubSubCreds & { readonly kind: 'emqx' });

/** Publish-only client. IoT when all four credentials exist; otherwise EMQX. */
export function createHttpPubSubFromSecretStore(
  creds: EmqxHttpPubSubCreds | IotHttpPubSubCreds,
  http: HttpClient
): PubSub {
  if ('endpoint' in creds) {
    return createIotHttpPubSub({
      endpoint: creds.endpoint,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      region: creds.region,
      now: creds.now,
      http,
    });
  }
  return createEmqxHttpPubSub({ ...creds, http });
}

let cached: Resolved | null | undefined;
let injected: PubSub | undefined;

export function setHttpPubSubOverride(pubsub: PubSub | undefined): void {
  injected = pubsub;
  cached = undefined;
}

export function resetHttpPubSubForTests(): void {
  cached = undefined;
  injected = undefined;
}

/**
 * Worker invalidation publisher. AWS IoT when the foundation stack has
 * written `IOT_*`; the local EMQX HTTP API otherwise. `now` signs each
 * IoT request and is the caller's clock, never the wall.
 */
export class HttpPubSubFromSecretStore {
  constructor(
    private readonly secretStore: SecretStore,
    private readonly now: () => number,
    private readonly http: HttpClient
  ) {}

  async get(): Promise<PubSub | undefined> {
    if (injected !== undefined) return injected;
    const creds = await this.resolve();
    if (creds === null) return undefined;
    return publisherFrom(creds, this.now, this.http);
  }

  private async resolve(): Promise<Resolved | null> {
    if (cached !== undefined) return cached;
    const iot = await this.readIot();
    if (iot !== null) {
      cached = iot;
      return iot;
    }
    const emqx = await this.readEmqx();
    cached = emqx;
    return emqx;
  }

  private async readIot(): Promise<Extract<Resolved, { kind: 'iot' }> | null> {
    const [endpoint, accessKeyId, secretAccessKey, region] = await Promise.all([
      this.readOptionalSecret(PubsubSecretName.iotDataEndpoint),
      this.readOptionalSecret(PubsubSecretName.iotAccessKeyId),
      this.readOptionalSecret(PubsubSecretName.iotSecretAccessKey),
      this.readOptionalSecret(PubsubSecretName.iotRegion),
    ]);
    if (
      endpoint.length === 0 ||
      accessKeyId.length === 0 ||
      secretAccessKey.length === 0 ||
      region.length === 0
    ) {
      return null;
    }
    return { kind: 'iot', endpoint, accessKeyId, secretAccessKey, region };
  }

  private async readEmqx(): Promise<Extract<
    Resolved,
    { kind: 'emqx' }
  > | null> {
    const [apiBaseUrl, apiKey, apiSecret] = await Promise.all([
      this.readOptionalSecret(PubsubSecretName.apiUrl),
      this.readOptionalSecret(PubsubSecretName.apiKey),
      this.readOptionalSecret(PubsubSecretName.apiSecret),
    ]);
    if (
      apiBaseUrl.length === 0 ||
      apiKey.length === 0 ||
      apiSecret.length === 0
    ) {
      return null;
    }
    return { kind: 'emqx', apiBaseUrl, apiKey, apiSecret };
  }

  private async readOptionalSecret(name: string): Promise<string> {
    const raw = await this.secretStore.getOptional(name);
    return raw?.readSecretValue()?.trim() ?? '';
  }
}

function publisherFrom(
  creds: Resolved,
  now: () => number,
  http: HttpClient
): PubSub {
  if (creds.kind === 'iot') {
    return createHttpPubSubFromSecretStore(
      {
        endpoint: creds.endpoint,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: creds.region,
        now,
      },
      http
    );
  }
  return createHttpPubSubFromSecretStore(
    {
      apiBaseUrl: creds.apiBaseUrl,
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
    },
    http
  );
}
