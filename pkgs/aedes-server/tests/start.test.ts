import { describe, expect, test } from 'bun:test';
import { createConnection } from 'node:net';
import { startAedesServer } from '@pkgs/aedes-server/start';

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
