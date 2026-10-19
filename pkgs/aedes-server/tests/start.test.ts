import { describe, expect, test } from 'bun:test';
import { createConnection } from 'node:net';
import {
  type AedesServerHandle,
  startAedesServer,
} from '@pkgs/aedes-server/start';
import mqtt from 'mqtt';

describe('startAedesServer', () => {
  test('starts isolated brokers and accepts HTTP publishes', async () => {
    const [first, second] = await Promise.all([
      startAedesServer(),
      startAedesServer(),
    ]);
    try {
      expect(first.mqttPort).not.toBe(second.mqttPort);
      expect(first.wsPort).not.toBe(second.wsPort);
      const response = await fetch(
        `${first.wsOrigin.replace('ws:', 'http:')}/api/v5/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: 'test:topic',
            payload: '{"ok":true}',
            qos: 1,
            retain: false,
          }),
        }
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({});
    } finally {
      await Promise.all([first.stop(), second.stop()]);
    }
  });
});

// regression: aedes-broker-never-listens
test('an isolated broker acknowledges a real MQTT connection', async () => {
  const broker = await startAedesServer();
  const client = createConnection({ host: '127.0.0.1', port: broker.mqttPort });
  try {
    const response = new Promise<Buffer>((resolve, reject) => {
      client.setTimeout(1_000);
      client.once('error', reject);
      client.once('timeout', () =>
        reject(new Error('The broker did not acknowledge CONNECT'))
      );
      client.once('data', resolve);
      client.once('connect', () => {
        // MQTT 3.1.1 CONNECT, clean session, client id "ci-broker".
        client.write(
          Buffer.from([
            0x10,
            21,
            0,
            4,
            77,
            81,
            84,
            84,
            4,
            2,
            0,
            30,
            0,
            9,
            ...Buffer.from('ci-broker'),
          ])
        );
      });
    });
    expect([...(await response)]).toEqual([0x20, 2, 0, 0]);
  } finally {
    client.destroy();
    await broker.stop();
  }
});

// regression: ungranted-system-topic-passes-pull-request
describe('a broker that admits clients', () => {
  const limited = {
    canSubscribe: (topic: string) => topic === 'user:granted',
    canPublish: (topic: string) => topic === 'user:granted',
    canReceive: (topic: string) => topic === 'user:granted',
  };

  async function connectAs(url: string, username: string) {
    const client = mqtt.connect(url, {
      username,
      password: 'secret',
      protocolVersion: 4,
      reconnectPeriod: 0,
    });
    const { promise, resolve, reject } = Promise.withResolvers<typeof client>();
    client.once('connect', () => resolve(client));
    client.once('error', reject);
    return promise;
  }

  async function withBroker(run: (broker: AedesServerHandle) => Promise<void>) {
    const broker = await startAedesServer({
      admit: ({ username }) =>
        username === 'limited'
          ? { kind: 'limited', access: limited }
          : username === 'open'
            ? { kind: 'open' }
            : { kind: 'refused' },
    });
    try {
      await run(broker);
    } finally {
      await broker.stop();
    }
  }

  test('refuses a subscription its session does not grant, and says so', async () => {
    await withBroker(async (broker) => {
      const client = await connectAs(broker.mqttUrl, 'limited');
      try {
        const granted = await client.subscribeAsync('user:granted', { qos: 1 });
        // The client library reports a refused grant (qos 128) as an error.
        await expect(
          client.subscribeAsync('system:chess_puzzles', { qos: 1 })
        ).rejects.toThrow();
        expect(granted[0]?.qos).toBe(1);
        expect(broker.denials()).toEqual([
          {
            operation: 'subscribe',
            clientId: expect.any(String),
            topic: 'system:chess_puzzles',
            cured: false,
          },
        ]);
      } finally {
        await client.endAsync(true);
      }
    });
  });

  test('delivers only what its session may receive', async () => {
    await withBroker(async (broker) => {
      const limitedClient = await connectAs(broker.mqttUrl, 'limited');
      const openClient = await connectAs(broker.mqttUrl, 'open');
      try {
        const received: string[] = [];
        limitedClient.on('message', (topic) => received.push(topic));
        await limitedClient.subscribeAsync('user:granted', { qos: 1 });
        await openClient.publishAsync('user:other', 'x', { qos: 1 });
        await openClient.publishAsync('user:granted', 'x', { qos: 1 });
        await Bun.sleep(100);
        expect(received).toEqual(['user:granted']);
      } finally {
        await Promise.all([
          limitedClient.endAsync(true),
          openClient.endAsync(true),
        ]);
      }
    });
  });

  test('refuses a client it does not admit', async () => {
    await withBroker(async (broker) => {
      await expect(connectAs(broker.mqttUrl, 'stranger')).rejects.toThrow();
      expect(broker.denials()).toEqual([
        {
          operation: 'connect',
          clientId: expect.any(String),
          topic: null,
          cured: false,
        },
      ]);
    });
  });

  // regression: push-subscribes-to-other-peoples-user-topics
  test('marks a refusal cured once the same client is let through, and not before', async () => {
    let granted = false;
    const broker = await startAedesServer({
      admit: () => ({
        kind: 'limited',
        access: {
          canSubscribe: (topic) => topic === 'room:new' && granted,
          canPublish: () => false,
          canReceive: () => true,
        },
      }),
    });
    try {
      const connect = () => {
        const client = mqtt.connect(broker.mqttUrl, {
          clientId: 'bob-phone',
          username: 'x',
          password: 'secret',
          protocolVersion: 4,
          reconnectPeriod: 0,
        });
        const { promise, resolve, reject } =
          Promise.withResolvers<typeof client>();
        client.once('connect', () => resolve(client));
        client.once('error', reject);
        return promise;
      };
      const stale = await connect();
      await expect(
        stale.subscribeAsync('room:new', { qos: 1 })
      ).rejects.toThrow();
      expect(broker.denials().map((d) => d.cured)).toEqual([false]);
      await stale.endAsync(true);
      granted = true;
      const fresh = await connect();
      await fresh.subscribeAsync('room:new', { qos: 1 });
      expect(broker.denials().map((d) => d.cured)).toEqual([true]);
      await fresh.endAsync(true);
    } finally {
      await broker.stop();
    }
  });
});
