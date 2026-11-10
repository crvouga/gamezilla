import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { createMqttPubSub } from '@pkgs/pubsub-mqtt-shared-ts/create-mqtt-pubsub';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { MqttClient } from 'mqtt';

/** mqtt.js rejects a PUBACK reason code as an Error carrying `code`. */
function errorWithReasonCode(message: string, code: number): Error {
  return Object.assign(new Error(message), { code });
}

class Broker extends EventEmitter {
  connected = false;
  published: string[] = [];
  refuseWith: number | null = null;
  subscribe(
    topic: string,
    _opts: unknown,
    done?: (
      error: Error | null,
      grants: { topic: string; qos: number }[]
    ) => void
  ) {
    done?.(null, [{ topic, qos: 1 }]);
  }
  unsubscribe() {}
  publish(
    topic: string,
    _payload: string,
    _opts: unknown,
    done: (error?: Error) => void
  ) {
    this.published.push(topic);
    done(
      this.refuseWith === null
        ? undefined
        : errorWithReasonCode('Publish error: Not authorized', this.refuseWith)
    );
  }
  end() {
    this.connected = false;
  }
}

async function settle() {
  for (let turn = 0; turn < 32; turn++) await Promise.resolve();
}

function session(granted: readonly Topic[]) {
  const clock = createHarnessClock();
  const brokers: Broker[] = [];
  let authCalls = 0;
  const pubsub = createMqttPubSub({
    url: 'wss://broker.example/mqtt',
    clientIdPrefix: 'device',
    timers: clock.timers,
    random: () => 0,
    logger: createNoopLogger(),
    auth: async () => {
      authCalls += 1;
      return { username: 'jwt', password: 'grant', topics: granted };
    },
    connectFn: () => {
      const broker = new Broker();
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

// regression: mqtt-ungranted-publish-drops-session
test('a publish the credentials do not grant is refused without leaving the session', async () => {
  const s = session(['user:alice']);
  try {
    await settle();
    expect(s.pubsub.status()).toBe('connected');
    await expect(s.pubsub.publish('room:new-space', {})).rejects.toThrow(
      'not granted'
    );
    s.clock.clock.advance(60_000);
    await settle();
    expect(s.brokers[0]?.published).toEqual([]);
    expect(s.brokers).toHaveLength(1);
    expect(s.authCalls()).toBe(1);
    expect(s.pubsub.status()).toBe('connected');
    await s.pubsub.publish('user:alice', { revision: 1 });
    expect(s.brokers[0]?.published).toEqual(['user:alice']);
  } finally {
    s.pubsub.close();
  }
});

// regression: mqtt-ungranted-publish-drops-session
test('a publish the broker refuses keeps the connection that carried the refusal', async () => {
  const s = session(['room:space']);
  try {
    await settle();
    const broker = s.brokers[0];
    if (broker === undefined) throw new Error('no broker');
    broker.refuseWith = 0x87;
    await expect(s.pubsub.publish('room:space', {})).rejects.toThrow(
      'Not authorized'
    );
    s.clock.clock.advance(60_000);
    await settle();
    expect(s.brokers).toHaveLength(1);
    expect(s.authCalls()).toBe(1);
    expect(s.pubsub.status()).toBe('connected');
  } finally {
    s.pubsub.close();
  }
});
