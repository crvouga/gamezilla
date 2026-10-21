// Cached PubSub contracts use a private local broker, never an injected endpoint.

import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { isolatedEmqxPorts } from '@pkgs/emqx-server-ts/free-ports';
import { startEmqxServer } from '@pkgs/emqx-server-ts/start';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_MQTT_PASS,
  EMQX_MQTT_USER,
} from '@pkgs/emqx-shared-ts/ports';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx-shared-ts/create-emqx-http-pubsub';
import {
  createEmqxPubSub,
  EMQX_PUBSUB_QOS,
} from '@pkgs/pubsub-emqx-shared-ts/create-emqx-pubsub';
import { getEmqxClientId } from '@pkgs/pubsub-emqx-shared-ts/emqx-client-id';
import { randomClientIdSuffix } from '@pkgs/pubsub-emqx-shared-ts/reconnect-backoff';
import { runPubSubContractTests } from '@pkgs/pubsub-root-shared-ts/contract';
import type { PubSubContractEnv } from '@pkgs/pubsub-root-shared-ts/contract-types';

const API_KEY = EMQX_API_KEY;
const API_SECRET = EMQX_API_SECRET;
const MQTT_USER = EMQX_MQTT_USER;
const MQTT_PASS = EMQX_MQTT_PASS;

// Start a broker of our own: its own
// ports and node name, so it never collides with a dev stack or another
// worktree's run. `startEmqxServer` resolves once it serves MQTT and its API.
const dataDir = join(tmpdir(), `emqx-contract-${randomUUID()}`);
const broker = await startEmqxServer({
  clock: wallClock,
  timers: wallTimers,
  http: createGlobalHttpClient(),
  dataDir,
  ...(await isolatedEmqxPorts(process.pid)),
});
const WSS_URL = `mqtt://127.0.0.1:${broker.mqttPort}`;
const API_URL = `http://127.0.0.1:${broker.dashboardPort}`;

// regression: cached-contract-external-credentials
test('injected EMQX endpoints cannot select an external fixture', () => {
  expect(new URL(WSS_URL).hostname).toBe('127.0.0.1');
  expect(new URL(API_URL).hostname).toBe('127.0.0.1');
});

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
        logger: createNoopLogger(),
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
        http,
      }),
    disruptTransport: async (p) => {
      const clientId = getEmqxClientId(p);
      if (!clientId) throw new Error('missing EMQX client id');
      // The kick is async: the client still reads `connected` when the API
      // answers, and with a 100ms backoff it can drop and reconnect between
      // two polls. Resolve on the drop event itself, so the contract's "wait
      // until connected" means "reconnected", not "not yet dropped".
      let unsubscribe = (): void => undefined;
      const dropped = new Promise<void>((resolve) => {
        unsubscribe = p.onStatus((s) => {
          if (s !== 'connected') resolve();
        });
      });
      try {
        await forceDisconnectClient(apiBaseUrl, clientId);
        await dropped;
      } finally {
        unsubscribe();
      }
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

runPubSubContractTests('emqx', makeContractEnv, {
  supportsDisruptTransport: true,
});

type LinkProxy = {
  readonly url: string;
  /** Destroy live connections and refuse new ones — a network outage. */
  cut(): void;
  restore(): void;
  stop(): void;
};

/**
 * A TCP relay the test can unplug. Kicking the client through the EMQX API
 * discards its session (the broker answers `CLIENTID_NOT_FOUND` and publishes
 * find no subscriber), so an offline buffer can only be observed across a
 * transport drop the broker did not ask for.
 */
function startLinkProxy(target: URL): LinkProxy {
  type Side = { peer: Bun.Socket<Side> | null; pending: Uint8Array[] };
  const live = new Set<Bun.Socket<Side>>();
  let down = false;
  const server = Bun.listen<Side>({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(client) {
        if (down) {
          client.end();
          return;
        }
        client.data = { peer: null, pending: [] };
        live.add(client);
        void Bun.connect<Side>({
          hostname: target.hostname,
          port: Number(target.port),
          data: { peer: client, pending: [] },
          socket: {
            open(upstream) {
              live.add(upstream);
              client.data.peer = upstream;
              for (const chunk of client.data.pending) upstream.write(chunk);
              client.data.pending = [];
            },
            data(upstream, chunk) {
              upstream.data.peer?.write(chunk);
            },
            close(upstream) {
              live.delete(upstream);
              upstream.data.peer?.end();
            },
          },
        }).catch(() => client.end());
      },
      data(client, chunk) {
        if (client.data.peer === null) client.data.pending.push(chunk);
        else client.data.peer.write(chunk);
      },
      close(client) {
        live.delete(client);
        client.data?.peer?.end();
      },
    },
  });
  return {
    url: `mqtt://127.0.0.1:${String(server.port)}`,
    cut() {
      down = true;
      for (const socket of live) socket.terminate();
      live.clear();
    },
    restore() {
      down = false;
    },
    stop() {
      server.stop(true);
    },
  };
}

describe('EMQX offline session buffer', () => {
  test('reconnect with same clientId receives queued qos1 publish', async () => {
    const apiBaseUrl = API_URL;
    const clientId = `offline_${randomClientIdSuffix(random)}`;
    const topic = `offline_${randomClientIdSuffix(random)}`;
    const received: unknown[] = [];
    const link = startLinkProxy(new URL(WSS_URL));

    const first = createEmqxPubSub({
      url: link.url,
      clientIdPrefix: clientId,
      timers,
      random,
      logger: createNoopLogger(),
      auth: async () => ({
        username: MQTT_USER,
        password: MQTT_PASS,
      }),
      reconnect: { baseMs: 1500, maxMs: 3000 },
    });
    try {
      await waitUntilStatus(() => first.status(), 'connected', 10_000);
      expect(first.status()).toBe('connected');
      first.subscribe(topic, (data) => {
        received.push(data);
      });
      await waitMs(400);

      link.cut();
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
      link.restore();

      await waitUntilStatus(() => first.status(), 'connected', 20_000);
      expect(first.status()).toBe('connected');

      const deadline = now() + 10_000;
      while (now() < deadline && received.length === 0) {
        await waitMs(50);
      }
      expect(received).toEqual([{ while: 'offline' }]);
    } finally {
      first.close();
      link.stop();
    }
  });
});

afterAll(() => {
  broker.stop();
});
