// goal:the-bar:5 — PubSub contract runs against local EMQX or externally
// supplied broker. When no broker URL is provided, starts EMQX automatically.

import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_MQTT_PASS,
  EMQX_MQTT_USER,
  startEmqxServer,
} from '@pkgs/emqx-server';
import { createGlobalHttpClient } from '@pkgs/http-client';
import {
  type PubSubContractEnv,
  runPubSubContractTests,
} from '@pkgs/pubsub/in-memory/contract';
import { createEmqxHttpPubSub } from './create-emqx-http-pubsub';
import { createEmqxPubSub, EMQX_PUBSUB_QOS } from './create-emqx-pubsub';
import { getEmqxClientId } from './emqx-client-id';
import { randomClientIdSuffix } from './reconnect-backoff';

let WSS_URL = process.env['EMQX_TEST_URL'] ?? '';
let API_URL = process.env['EMQX_TEST_API_URL'] ?? '';
const API_KEY = process.env['EMQX_TEST_API_KEY'] ?? EMQX_API_KEY;
const API_SECRET = process.env['EMQX_TEST_API_SECRET'] ?? EMQX_API_SECRET;
const MQTT_USER = process.env['EMQX_TEST_MQTT_USER'] ?? EMQX_MQTT_USER;
const MQTT_PASS = process.env['EMQX_TEST_MQTT_PASS'] ?? EMQX_MQTT_PASS;
let stopEmqx: (() => void) | undefined;

// When no EMQX test URL is supplied, start the broker locally.
if (!WSS_URL || !API_URL) {
  const dataDir = join(tmpdir(), `emqx-contract-${randomUUID()}`);
  const broker = await startEmqxServer({ dataDir });
  WSS_URL = `mqtt://127.0.0.1:${broker.mqttPort}`;
  API_URL = `http://127.0.0.1:${broker.dashboardPort}`;
  stopEmqx = () => broker.stop();
}

const http = createGlobalHttpClient();
const now = wallClock.now;
const timers = wallTimers;
const random = Math.random;

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

function apiHeaders(): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`${API_KEY}:${API_SECRET}`)}`,
    Accept: 'application/json',
  };
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
        ...apiHeaders(),
        'Content-Type': 'application/json',
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
      headers: apiHeaders(),
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`force-disconnect failed: ${String(res.status)}`);
  }
}

async function makeContractEnv(): Promise<PubSubContractEnv> {
  const apiBaseUrl = API_URL;
  const instances: ReturnType<typeof createEmqxPubSub>[] = [];

  return {
    make: async () => {
      const ps = createEmqxPubSub({
        url: WSS_URL,
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
        throw new Error('EMQX MQTT failed to connect');
      }
      return ps;
    },
    makePublishOnly: async () =>
      createEmqxHttpPubSub({
        apiBaseUrl,
        apiKey: API_KEY,
        apiSecret: API_SECRET,
        fetchImpl: (input, init) => http.fetch(input, init),
      }),
    disruptTransport: async (p) => {
      const clientId = getEmqxClientId(p);
      if (!clientId) throw new Error('missing EMQX client id');
      await forceDisconnectClient(apiBaseUrl, clientId);
    },
    injectMalformedInbound: async (_subscriber, topic) => {
      await httpPublish(apiBaseUrl, topic, 'not-json{{{');
    },
    clock: wallClock,
    timers: wallTimers,
    teardown: async () => {
      for (const ps of instances) ps.close();
    },
  };
}

runPubSubContractTests('emqx', makeContractEnv);

describe('EMQX offline session buffer', () => {
  test('reconnect with same clientId receives queued qos1 publish', async () => {
    const apiBaseUrl = API_URL;
    const clientId = `offline_${randomClientIdSuffix(random)}`;
    const topic = `offline_${randomClientIdSuffix(random)}`;
    const received: unknown[] = [];

    const first = createEmqxPubSub({
      url: WSS_URL,
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
    await waitMs(400);

    await forceDisconnectClient(apiBaseUrl, clientId);
    await waitUntilStatus(
      () => first.status(),
      (s) => s !== 'connected',
      5000
    );
    expect(first.status()).not.toBe('connected');

    await httpPublish(apiBaseUrl, topic, JSON.stringify({ while: 'offline' }));

    await waitUntilStatus(() => first.status(), 'connected', 20_000);
    expect(first.status()).toBe('connected');

    const deadline = now() + 10_000;
    while (now() < deadline && received.length === 0) {
      await waitMs(50);
    }
    expect(received).toEqual([{ while: 'offline' }]);
    first.close();
  });
});

afterAll(() => {
  stopEmqx?.();
});
