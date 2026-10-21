import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger, type Logger } from '@pkgs/logger-shared/logger';
import { createMqttPubSub } from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import type { MqttClient } from 'mqtt';

/** A broker that ends the session on any subscription its grants refuse. */
class Broker extends EventEmitter {
  connected = false;
  subscriptions: string[] = [];
  refusals = 0;
  constructor(private readonly granted: ReadonlySet<string>) {
    super();
  }
  subscribe(
    topic: string,
    _opts: unknown,
    done?: (
      error: Error | null,
      grants: { topic: string; qos: number }[]
    ) => void
  ) {
    this.subscriptions.push(topic);
    const allowed = this.granted.has(topic);
    if (!allowed) this.refusals += 1;
    done?.(null, [{ topic, qos: allowed ? 1 : 135 }]);
  }
  unsubscribe(topic: string) {
    this.subscriptions = this.subscriptions.filter((t) => t !== topic);
  }
  end() {
    this.connected = false;
  }
}

async function settle() {
  for (let turn = 0; turn < 32; turn++) await Promise.resolve();
}

/** `grants[n]` is what the n-th token grants; the last repeats. */
function connection(grants: readonly (readonly string[])[], logger?: Logger) {
  const clock = createHarnessClock();
  const brokers: Broker[] = [];
  let authCalls = 0;
  const grantFor = (call: number) =>
    grants[Math.min(call, grants.length) - 1] ?? [];
  const pubsub = createMqttPubSub({
    url: 'wss://broker.example/mqtt',
    clientIdPrefix: 'device',
    timers: clock.timers,
    random: () => 0,
    logger: logger ?? createNoopLogger(),
    auth: async () => {
      authCalls += 1;
      return {
        username: 'jwt',
        password: `token-${authCalls}`,
        topics: grantFor(authCalls),
      };
    },
    connectFn: () => {
      const broker = new Broker(new Set(grantFor(authCalls)));
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

async function later(c: ReturnType<typeof connection>, ms: number) {
  for (let step = 0; step < 10; step++) {
    c.clock.clock.advance(ms / 10);
    await settle();
  }
}

// regression: one-refused-room-ends-realtime
test('a held room the token does not grant is left out, and every other topic stays live', async () => {
  const warnings: unknown[] = [];
  const logger: Logger = {
    ...createNoopLogger(),
    debug: (message, fields) => {
      warnings.push([message, fields]);
    },
  };
  const c = connection([['user:me', 'room:live']], logger);
  try {
    const received: unknown[] = [];
    c.pubsub.subscribe('user:me', () => {});
    c.pubsub.subscribe('room:gone', () => {});
    c.pubsub.subscribe('room:live', (data) => received.push(data));
    await settle();
    await later(c, 60_000);
    // Wanted after the first token was asked for: one fresh answer, then no
    // more asking, and the broker is never asked for what it would refuse.
    expect(c.authCalls()).toBe(2);
    expect(c.brokers.every((broker) => broker.refusals === 0)).toBe(true);
    const session = c.brokers.at(-1);
    expect(session?.subscriptions.sort()).toEqual(['room:live', 'user:me']);
    expect(c.pubsub.status()).toBe('connected');
    session?.emit('message', 'room:live', Buffer.from('{"revision":1}'));
    expect(received).toEqual([{ revision: 1 }]);
    expect(warnings).toEqual([
      [
        'topics not granted; left out of the session',
        { topics: ['room:gone'] },
      ],
    ]);
  } finally {
    c.pubsub.close();
  }
});

test('a room joined after the token was fetched asks for one fresh token and is delivered', async () => {
  const c = connection([['user:me'], ['user:me', 'room:joined']]);
  try {
    c.pubsub.subscribe('user:me', () => {});
    await settle();
    expect(c.pubsub.status()).toBe('connected');
    const received: unknown[] = [];
    c.pubsub.subscribe('room:joined', (data) => received.push(data));
    await later(c, 1_000);
    expect(c.authCalls()).toBe(2);
    expect(c.brokers[1]?.subscriptions.sort()).toEqual([
      'room:joined',
      'user:me',
    ]);
    c.brokers[1]?.emit('message', 'room:joined', Buffer.from('{"n":1}'));
    expect(received).toEqual([{ n: 1 }]);
    expect(c.brokers.every((broker) => broker.refusals === 0)).toBe(true);
    expect(c.pubsub.status()).toBe('connected');
  } finally {
    c.pubsub.close();
  }
});

test('a room a fresh token still refuses is asked about once, then left out until wanted again', async () => {
  const c = connection([['user:me']]);
  try {
    c.pubsub.subscribe('user:me', () => {});
    await settle();
    const stop = c.pubsub.subscribe('room:refused', () => {});
    await later(c, 60_000);
    expect(c.authCalls()).toBe(2);
    expect(c.pubsub.status()).toBe('connected');
    expect(c.brokers.every((broker) => broker.refusals === 0)).toBe(true);

    stop();
    c.pubsub.subscribe('room:refused', () => {});
    await later(c, 60_000);
    expect(c.authCalls()).toBe(3);
    expect(c.pubsub.status()).toBe('connected');
  } finally {
    c.pubsub.close();
  }
});
