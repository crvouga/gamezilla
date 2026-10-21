// @io-wall-ok — live health: this environment's AWS IoT data plane.
/** `specs/spaces/live-updates.feature`. */

import { expect } from 'bun:test';
import { ClientConfigKey } from '@libs/app-config-shared-ts/client-config-keys';
import { parseClientConfigRows } from '@libs/app-config-shared-ts/parse-client-config';
import { PubsubSecretName as Name } from '@libs/pubsub-shared-ts/secret-names';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { COMMITTED_EMQX_CREDENTIALS } from '@pkgs/emqx-shared-ts/ports';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import {
  createIotHttpPubSub,
  iotEndpointHost,
} from '@pkgs/pubsub-root-shared-ts/create-iot-http-pubsub';
import { probeIotDataPlane } from '@pkgs/pubsub-root-shared-ts/probe-iot-data-plane';
import { awaitApiAnswered, liveRows } from './client-config.steps';
import { eventually, Then } from './define';
import { liveSecret } from './live-secrets';
import type { LiveWorld } from './live-world';
import { wallWait } from './wall-wait';

/** A custom domain's first answer can lag the apply by a couple of minutes. */
const DATA_PLANE_WARMUP_MS = 3 * 60 * 1000;
const RETRY_MS = 10_000;

type Publisher = {
  readonly host: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

async function publisher(w: LiveWorld): Promise<Publisher> {
  return {
    host: iotEndpointHost(await liveSecret(w, Name.iotDataEndpoint)),
    region: await liveSecret(w, Name.iotRegion),
    accessKeyId: await liveSecret(w, Name.iotAccessKeyId),
    secretAccessKey: await liveSecret(w, Name.iotSecretAccessKey),
  };
}

async function statusOf(
  http: HttpClient,
  url: string,
  init?: RequestInit
): Promise<number> {
  try {
    const res = await http.fetch(url, init);
    await res.body?.cancel();
    return res.status;
  } catch {
    return 0;
  }
}

/** Unsigned requests are refused, which is how the data plane shows it is there. */
Then('what happens in a space can reach everyone in it', async (w) => {
  const host = iotEndpointHost(await liveSecret(w, Name.iotDataEndpoint));
  const ready = await eventually(
    async () => {
      try {
        return await probeIotDataPlane({
          endpoint: host,
          fetchImpl: (input, init) => w.http.fetch(input, init),
        });
      } catch {
        return false;
      }
    },
    { maxWaitMs: DATA_PLANE_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  expect(ready, 'the publish authorization gate did not answer').toBe(true);
});

/** The server's publish path accepts a message. */
Then('the app can pass on what happens in a space', async (w) => {
  const creds = await publisher(w);
  const pubsub = createIotHttpPubSub({
    endpoint: creds.host,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
    now: () => wallClock.now(),
    http: w.http,
  });
  await pubsub.publish('health-ping', { ok: true });
});

/**
 * Clients are given this environment's WebSocket address from the secret
 * store, and the synced config is that same address.
 */
Then(
  "people's apps follow what happens in this environment's spaces",
  async (w) => {
    const wssUrl = await liveSecret(w, Name.wssUrl);
    await awaitApiAnswered(w);
    expect(new URL(wssUrl).protocol).toBe('wss:');
    const config = parseClientConfigRows(await liveRows());
    expect(config[ClientConfigKey.emqxWssUrl]).toBe(wssUrl);
  }
);

/** An unsigned publish is refused. There is no stock admin login on IoT. */
Then(
  'nobody can listen in on spaces or disturb them with the default password',
  async (w) => {
    const host = iotEndpointHost(await liveSecret(w, Name.iotDataEndpoint));
    const status = await statusOf(
      w.http,
      `https://${host}/topics/${encodeURIComponent('health-ping')}?qos=1`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: '{}',
      }
    );
    expect(status).not.toBe(200);
  }
);

/** No deployed credential is one of the committed public sidecar values. */
Then(
  'nobody can listen in on spaces or disturb them with a publicly known password',
  async (w) => {
    const committed: string[] = [];
    for (const name of [Name.iotSecretAccessKey, Name.jwtSecret]) {
      if (COMMITTED_EMQX_CREDENTIALS.has(await liveSecret(w, name))) {
        committed.push(name);
      }
    }
    expect(committed).toEqual([]);
  }
);
