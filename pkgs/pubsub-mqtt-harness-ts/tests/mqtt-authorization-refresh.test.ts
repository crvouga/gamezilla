import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createNoopLogger, type Logger } from '@pkgs/logger-shared-ts/logger';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createMqttPubSub } from '@pkgs/pubsub-mqtt-shared-ts/create-mqtt-pubsub';
import fc from 'fast-check';
import type { MqttClient } from 'mqtt';

class Broker extends EventEmitter {
  connected = false;
  subscriptions: string[] = [];
  refused = true;
  refusalCode = 135;
  subscribe(
    topic: string,
    _opts: unknown,
    done?: (
      error: Error | null,
      grants: { topic: string; qos: number }[]
    ) => void
  ) {
    this.subscriptions.push(topic);
    done?.(null, [{ topic, qos: this.refused ? this.refusalCode : 1 }]);
  }
  publish(
    _topic: string,
    _payload: string,
    _opts: unknown,
    done: (error?: Error) => void
  ) {
    done(this.refused ? new Error('Publish error: Not authorized') : undefined);
  }
  end() {
    this.connected = false;
  }
}

async function settle() {
  for (let turn = 0; turn < 32; turn++) await Promise.resolve();
}

function connection(
  refusals = 1,
  refusalCode = 135,
  random: () => number = () => 0,
  logger: Logger = createNoopLogger()
) {
  const clock = createHarnessClock();
  const brokers: Broker[] = [];
  let authCalls = 0;
  const pubsub = createMqttPubSub({
    url: 'wss://broker.example/mqtt',
    clientIdPrefix: 'device',
    timers: clock.timers,
    random,
    logger,
    auth: async () => ({ username: 'jwt', password: `grant-${++authCalls}` }),
    connectFn: () => {
      const broker = new Broker();
      broker.refused = brokers.length < refusals;
      broker.refusalCode = refusalCode;
      brokers.push(broker);
      queueMicrotask(() => {
        broker.connected = true;
        broker.emit('connect');
      });
      return broker as unknown as MqttClient;
    },
  });
  return { pubsub, brokers, clock, authCalls: () => authCalls };
}

// regression: mqtt-stale-topic-authorization
test('a denied room subscription refreshes authorization and restores delivery', async () => {
  const c = connection();
  try {
    await settle();
    const received: unknown[] = [];
    c.pubsub.subscribe('room:new-space', (data) => received.push(data));
    expect(c.pubsub.status()).toBe('connecting');
    c.clock.clock.advance(1);
    await settle();
    expect(c.authCalls()).toBe(2);
    expect(c.brokers[1]?.subscriptions).toEqual(['room:new-space']);
    c.brokers[1]?.emit(
      'message',
      'room:new-space',
      Buffer.from('{"revision":1}')
    );
    expect(received).toEqual([{ revision: 1 }]);
    expect(c.pubsub.status()).toBe('connected');
  } finally {
    c.pubsub.close();
  }
});

test('refused subscription grants recover without losing desired topics', async () => {
  await assertProperty(
    'MQTT authorization recovery',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 128, max: 255 }),
      async (refusals, code) => {
        const c = connection(refusals, code);
        try {
          await settle();
          c.pubsub.subscribe('room:new-space', () => {});
          for (let attempt = 0; attempt < refusals; attempt++) {
            expect(c.pubsub.status()).toBe('connecting');
            c.clock.clock.advance(1);
            await settle();
          }
          expect(c.authCalls()).toBe(refusals + 1);
          expect(c.pubsub.status()).toBe('connected');
          expect(c.brokers.at(-1)?.subscriptions).toEqual(['room:new-space']);
        } finally {
          c.pubsub.close();
        }
      }
    )
  );
});

// regression: mqtt-stale-topic-authorization
test('a rejected publish fails honestly and refreshes credentials for subsequent writes', async () => {
  const c = connection();
  try {
    await settle();
    await expect(c.pubsub.publish('room:new-space', {})).rejects.toThrow(
      'Not authorized'
    );
    c.clock.clock.advance(1);
    await settle();
    expect(c.authCalls()).toBe(2);
    await c.pubsub.publish('room:new-space', { revision: 2 });
  } finally {
    c.pubsub.close();
  }
});

// regression: mqtt-ungranted-topic-reconnect-loop
test('a topic no token grants backs reconnects off instead of retrying at the shortest delay', async () => {
  const c = connection(Number.MAX_SAFE_INTEGER, 135, () => 0.999);
  try {
    await settle();
    c.pubsub.subscribe('system:never-granted', () => {});
    c.clock.clock.advance(499);
    await settle();
    expect(c.authCalls()).toBe(2);
    c.clock.clock.advance(500);
    await settle();
    expect(c.authCalls()).toBe(2);
    c.clock.clock.advance(500);
    await settle();
    expect(c.authCalls()).toBe(3);
  } finally {
    c.pubsub.close();
  }
});

// regression: mqtt-refusal-warned-once-per-topic
test('a refused batch of topics warns once per attempt, not once per topic', async () => {
  const warnings: string[] = [];
  const logger: Logger = {
    ...createNoopLogger(),
    warn: (message) => {
      warnings.push(message);
    },
  };
  const c = connection(Number.MAX_SAFE_INTEGER, 135, () => 0, logger);
  try {
    await settle();
    for (let room = 0; room < 33; room++) {
      c.pubsub.subscribe(`room:space-${room}`, () => {});
    }
    await settle();
    expect(warnings).toEqual([
      'subscription rejected; refreshing authorization',
    ]);
  } finally {
    c.pubsub.close();
  }
});
