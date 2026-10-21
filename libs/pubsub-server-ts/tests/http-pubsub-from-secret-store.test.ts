import { describe, expect, test } from 'bun:test';
import {
  HttpPubSubFromSecretStore,
  resetHttpPubSubForTests,
} from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { PubsubSecretName as Name } from '@libs/pubsub-shared-ts/secret-names';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';

function secretStore(values: Readonly<Record<string, string>>): SecretStore {
  return {
    async getOptional(name: string) {
      const value = values[name];
      if (value === undefined || value.trim() === '') return null;
      return { readSecretValue: () => value } as never;
    },
    async getRequired() {
      throw new Error('unused');
    },
    async getRequiredMany() {
      throw new Error('unused');
    },
    async getOptionalMany() {
      throw new Error('unused');
    },
    async setSecret() {
      throw new Error('unused');
    },
  };
}

const IOT = {
  [Name.iotDataEndpoint]: 'aaaa.iot.us-east-1.amazonaws.com',
  [Name.iotAccessKeyId]: 'AKIDEXAMPLE',
  [Name.iotSecretAccessKey]: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  [Name.iotRegion]: 'us-east-1',
  [Name.apiUrl]: 'http://127.0.0.1:18083',
  [Name.apiKey]: 'local-key',
  [Name.apiSecret]: 'local-secret',
};

async function publishUrl(
  values: Readonly<Record<string, string>>
): Promise<string | undefined> {
  const calls: string[] = [];
  const http = {
    async fetch(this: unknown, input: RequestInfo | URL) {
      // regression: cloudflare-pubsub-fetch-illegal-invocation
      if (this !== http) throw new TypeError('Illegal invocation');
      calls.push(String(input));
      return new Response(null, { status: 200 });
    },
  };
  try {
    const pubsub = await new HttpPubSubFromSecretStore(
      secretStore(values),
      () => 0,
      http
    ).get();
    if (pubsub === undefined) return undefined;
    await pubsub.publish('user:actor1', { ok: true });
    return calls[0];
  } finally {
    resetHttpPubSubForTests();
  }
}

describe('HttpPubSubFromSecretStore', () => {
  test('publishes to IoT when the four credentials exist', async () => {
    const url = await publishUrl(IOT);
    expect(url).toBe(
      'https://aaaa.iot.us-east-1.amazonaws.com/topics/user%2Factor1?qos=1'
    );
  });

  test('publishes to the local EMQX API when IoT credentials are absent', async () => {
    const url = await publishUrl({
      [Name.apiUrl]: 'http://127.0.0.1:18083',
      [Name.apiKey]: 'local-key',
      [Name.apiSecret]: 'local-secret',
    });
    expect(url).toBe('http://127.0.0.1:18083/api/v5/publish');
  });

  test('publishes nowhere when neither broker is configured', async () => {
    expect(await publishUrl({})).toBeUndefined();
  });
});
