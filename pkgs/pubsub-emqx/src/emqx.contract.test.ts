import { describe, expect, test } from 'bun:test';
import { wallIo } from '@pkgs/io';
import {
  type PubSubContractEnv,
  runPubSubContractTests,
} from '@pkgs/pubsub/testing';
import { createEmqxHttpPubSub } from './create-emqx-http-pubsub';
import { createEmqxPubSub, EMQX_PUBSUB_QOS } from './create-emqx-pubsub';
import { getEmqxClientId } from './emqx-client-id';
import { randomClientIdSuffix } from './reconnect-backoff';

const WSS_URL = process.env['EMQX_TEST_URL'];
const API_URL = process.env['EMQX_TEST_API_URL'];
const API_KEY = process.env['EMQX_TEST_API_KEY'] ?? 'pubsub-test';
const API_SECRET = process.env['EMQX_TEST_API_SECRET'] ?? 'pubsub-test-secret';
const MQTT_USER = process.env['EMQX_TEST_MQTT_USER'] ?? 'pubsub';
const MQTT_PASS = process.env['EMQX_TEST_MQTT_PASS'] ?? 'pubsub';

const io = wallIo();
const http = io.http;
const now = io.clock.now;
const timers = io.timers;
const random = io.random;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

async function waitUntilStatus(
  getStatus: () => string,
  wanted: string | ((s: string) => boolean),
  timeoutMs: number
): Promise<void> {
  const deadline = now() + timeoutMs;
  const match =
    typeof wanted === 'string' ? (s: string) => s === wanted : wanted;
  while (now() < deadline && !match(getStatus())) {
    await waitMs(50);
  }
}

async function probeBroker(): Promise<boolean> {
  if (!WSS_URL || !API_URL) return false;
  try {
    const res = await http.fetch(
      `${API_URL.replace(/\/$/, '')}/api/v5/status`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2000),
      }
    );
    return res.ok || res.status === 401 || res.status === 404;
  } catch {
    return false;
  }
}

async function httpPublish(
  apiBaseUrl: string,
  topic: string,
  payload: string
): Promise<void> {
  const res = await http.fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/api/v5/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        topic,
        payload,
        qos: EMQX_PUBSUB_QOS,
        retain: false,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`EMQX publish failed: ${String(res.status)}`);
  }
}

async function forceDisconnectClient(
  apiBaseUrl: string,
  clientId: string
): Promise<void> {
  const res = await http.fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/api/v5/clients/${encodeURIComponent(clientId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
        Accept: 'application/json',
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`force-disconnect failed: ${String(res.status)}`);
  }
}

const brokerReady = await probeBroker();

if (!brokerReady) {
  describe('PubSub contract: emqx (skipped)', () => {
    test('loud skip — set EMQX_TEST_URL and EMQX_TEST_API_URL with a running EMQX 5.x', () => {
      console.warn(
        '[pubsub-emqx] broker contract skipped: EMQX unreachable. ' +
          'See README for brew install emqx + env vars.'
      );
      expect(true).toBe(true);
    });
  });
} else {
  runPubSubContractTests('emqx', async (): Promise<PubSubContractEnv> => {
    const apiBaseUrl = API_URL!;
    const instances: ReturnType<typeof createEmqxPubSub>[] = [];

    return {
      make: async () => {
        // Unique stable id per instance so concurrent contract peers do not kick each other.
        const ps = createEmqxPubSub({
          url: WSS_URL!,
          clientIdPrefix: `contract_${randomClientIdSuffix(random)}`,
          timers,
          random,
          auth: async () => ({
            username: MQTT_USER,
            password: MQTT_PASS,
          }),
          reconnect: { baseMs: 100, maxMs: 1000 },
        });
        instances.push(ps);
        await waitUntilStatus(() => ps.status(), 'connected', 10_000);
        if (ps.status() !== 'connected') {
          throw new Error('EMQX WSS failed to connect');
        }
        return ps;
      },
      makePublishOnly: async () =>
        createEmqxHttpPubSub({
          apiBaseUrl,
          apiKey: API_KEY,
          apiSecret: API_SECRET,
        }),
      disruptTransport: async (p) => {
        const clientId = getEmqxClientId(p);
        if (!clientId) throw new Error('missing EMQX client id');
        await forceDisconnectClient(apiBaseUrl, clientId);
      },
      injectMalformedInbound: async (_subscriber, topic) => {
        await httpPublish(apiBaseUrl, topic, 'not-json{{{');
      },
      teardown: async () => {
        for (const ps of instances) ps.close();
      },
    };
  });

  describe('EMQX offline session buffer', () => {
    test('reconnect with same clientId receives queued qos1 publish', async () => {
      const apiBaseUrl = API_URL!;
      const clientId = `offline_${randomClientIdSuffix(random)}`;
      const topic = `offline_${randomClientIdSuffix(random)}`;
      const received: unknown[] = [];

      // Slow reconnect so we can publish while the session is offline.
      const first = createEmqxPubSub({
        url: WSS_URL!,
        clientIdPrefix: clientId,
        timers,
        random,
        auth: async () => ({
          username: MQTT_USER,
          password: MQTT_PASS,
        }),
        reconnect: { baseMs: 1500, maxMs: 3000 },
      });
      await waitUntilStatus(() => first.status(), 'connected', 10_000);
      expect(first.status()).toBe('connected');
      first.subscribe(topic, (data) => {
        received.push(data);
      });
      // Allow SUBSCRIBE to settle on the broker before forcing disconnect.
      await waitMs(400);

      await forceDisconnectClient(apiBaseUrl, clientId);
      await waitUntilStatus(
        () => first.status(),
        (s) => s !== 'connected',
        5000
      );
      expect(first.status()).not.toBe('connected');

      await httpPublish(
        apiBaseUrl,
        topic,
        JSON.stringify({ while: 'offline' })
      );

      await waitUntilStatus(() => first.status(), 'connected', 20_000);
      expect(first.status()).toBe('connected');

      {
        const deadline = now() + 10_000;
        while (now() < deadline && received.length === 0) {
          await waitMs(50);
        }
      }
      expect(received).toEqual([{ while: 'offline' }]);
      first.close();
    });
  });
}
