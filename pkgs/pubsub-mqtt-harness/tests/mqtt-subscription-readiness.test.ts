import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createMqttPubSub } from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import fc from 'fast-check';
import type { MqttClient } from 'mqtt';

type Ack = (
  error: Error | null,
  grants: { topic: string; qos: number }[]
) => void;

class DelayedBroker extends EventEmitter {
  connected = false;
  readonly subscriptions: { topic: string; ack: Ack }[] = [];
  subscribe(topic: string, _options: unknown, ack: Ack) {
    this.subscriptions.push({ topic, ack });
  }
  unsubscribe() {}
  end() {
    this.connected = false;
  }
  connect() {
    this.connected = true;
    this.emit('connect');
  }
  accept(index: number) {
    const sub = this.subscriptions[index]!;
    sub.ack(null, [{ topic: sub.topic, qos: 1 }]);
  }
}

async function connection() {
  const broker = new DelayedBroker();
  const ps = createMqttPubSub({
    url: 'ws://broker.example/mqtt',
    auth: async () => ({ username: 'test', password: 'test' }),
    clientIdPrefix: 'device',
    timers: createHarnessClock().timers,
    random: () => 0,
    logger: createNoopLogger(),
    connectFn: () => broker as unknown as MqttClient,
  });
  for (let turn = 0; turn < 16; turn++) await Promise.resolve();
  return { broker, ps };
}

// regression: mqtt-snapshot-before-suback-loses-push
test('a pairing committed between the first snapshot and SUBACK is reconciled after subscription acceptance', async () => {
  const { broker, ps } = await connection();
  let server = 'waiting';
  let screen = '';
  ps.onStatus((status) => {
    if (status === 'connected') screen = server;
  });
  try {
    broker.connect();
    expect(screen).toBe('waiting');
    ps.subscribe('room:space', () => {
      screen = server;
    });
    // The broker cannot deliver this change to a subscription it has not accepted.
    server = 'matched';
    broker.accept(0);
    expect(screen).toBe('matched');
    expect(ps.status()).toBe('connected');
  } finally {
    ps.close();
  }
});

test('initial readiness waits for every desired topic regardless of acknowledgment order', async () => {
  await assertProperty(
    'MQTT subscription readiness',
    fc.asyncProperty(
      fc.uniqueArray(fc.integer({ min: 0, max: 5 }), {
        minLength: 1,
        maxLength: 6,
      }),
      async (order) => {
        const { broker, ps } = await connection();
        let ready = 0;
        ps.onStatus((status) => {
          if (status === 'connected') ready++;
        });
        try {
          for (let index = 0; index < order.length; index++)
            ps.subscribe(`room:space-${index}` as Topic, () => {});
          broker.connect();
          expect(ready).toBe(0);
          const indexes = order
            .map((value, index) => ({ value, index }))
            .sort((a, b) => a.value - b.value);
          for (let n = 0; n < indexes.length; n++) {
            broker.accept(indexes[n]!.index);
            expect(ps.status()).toBe(
              n === indexes.length - 1 ? 'connected' : 'connecting'
            );
          }
          expect(ready).toBe(1);
        } finally {
          ps.close();
        }
      }
    )
  );
});

test('an old acknowledgment cannot complete a replacement subscription on the same connection', async () => {
  const { broker, ps } = await connection();
  try {
    broker.connect();
    const remove = ps.subscribe('room:space', () => {});
    remove();
    ps.subscribe('room:space', () => {});
    broker.accept(0);
    expect(ps.status()).toBe('connecting');
    broker.accept(1);
    expect(ps.status()).toBe('connected');
  } finally {
    ps.close();
  }
});
