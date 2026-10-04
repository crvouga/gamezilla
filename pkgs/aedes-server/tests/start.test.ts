import { describe, expect, test } from 'bun:test';
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
