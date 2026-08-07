import { describe, expect, test } from 'bun:test';
import {
  type PubSubContractEnv,
  runPubSubContractTests,
} from '@pkgs/pubsub/testing';
import { createEmqxHttpPubSub } from './create-emqx-http-pubsub';
import { createEmqxPubSub } from './create-emqx-pubsub';
import { getEmqxClientId } from './emqx-client-id';

const WSS_URL = process.env['EMQX_TEST_URL'];
const API_URL = process.env['EMQX_TEST_API_URL'];
const API_KEY = process.env['EMQX_TEST_API_KEY'] ?? 'pubsub-test';
const API_SECRET = process.env['EMQX_TEST_API_SECRET'] ?? 'pubsub-test-secret';
const MQTT_USER = process.env['EMQX_TEST_MQTT_USER'] ?? 'pubsub';
const MQTT_PASS = process.env['EMQX_TEST_MQTT_PASS'] ?? 'pubsub';

async function probeBroker(): Promise<boolean> {
  if (!WSS_URL || !API_URL) return false;
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/v5/status`, {
      headers: {
        Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok || res.status === 401 || res.status === 404;
  } catch {
    return false;
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
        const ps = createEmqxPubSub({
          url: WSS_URL!,
          clientIdPrefix: 'contract',
          auth: async () => ({
            username: MQTT_USER,
            password: MQTT_PASS,
          }),
          reconnect: { baseMs: 100, maxMs: 1000 },
        });
        instances.push(ps);
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline && ps.status() !== 'connected') {
          await new Promise((r) => setTimeout(r, 50));
        }
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
        const res = await fetch(
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
      },
      injectMalformedInbound: async (_subscriber, topic) => {
        const res = await fetch(
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
              payload: 'not-json{{{',
              qos: 0,
              retain: false,
            }),
          }
        );
        if (!res.ok) {
          throw new Error(`malformed inject failed: ${String(res.status)}`);
        }
      },
      teardown: async () => {
        for (const ps of instances) ps.close();
      },
    };
  });
}
