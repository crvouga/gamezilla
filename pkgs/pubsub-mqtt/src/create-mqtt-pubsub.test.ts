import { describe, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { wallTimers } from '@pkgs/clock';
import { createNoopLogger, type Logger } from '@pkgs/logger';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { IClientOptions, MqttClient } from 'mqtt';
import {
  createMqttPubSub,
  MQTT_PUBSUB_QOS,
  MQTT_SESSION_EXPIRY_SEC,
} from './create-mqtt-pubsub';

class FakeMqttClient extends EventEmitter {
  connected = false;
  readonly subscribeCalls: { topic: string; qos: number }[] = [];
  readonly unsubscribeCalls: string[] = [];
  readonly publishCalls: {
    topic: string;
    payload: string;
    qos: number;
    retain: boolean;
  }[] = [];
  readonly endCalls: { force?: boolean; opts?: unknown }[] = [];
  ended = false;

  subscribe(topic: string, opts?: { qos?: number }): this {
    this.subscribeCalls.push({ topic, qos: opts?.qos ?? 0 });
    return this;
  }

  unsubscribe(topic: string): this {
    this.unsubscribeCalls.push(topic);
    return this;
  }

  publish(
    topic: string,
    payload: string | Buffer,
    opts?: { qos?: number; retain?: boolean },
    cb?: (err?: Error) => void
  ): this {
    this.publishCalls.push({
      topic,
      payload: String(payload),
      qos: opts?.qos ?? 0,
      retain: opts?.retain ?? false,
    });
    cb?.();
    return this;
  }

  end(force?: boolean, opts?: unknown): this {
    const call: { force?: boolean; opts?: unknown } = {};
    if (force !== undefined) call.force = force;
    if (opts !== undefined) call.opts = opts;
    this.endCalls.push(call);
    this.ended = true;
    this.connected = false;
    return this;
  }

  simulateConnect(): void {
    this.connected = true;
    this.emit('connect');
  }
}

async function waitUntil(pred: () => boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (pred()) return;
    await new Promise<void>((resolve) => {
      wallTimers.setTimeout(resolve, 5);
    });
  }
  throw new Error('waitUntil timed out');
}

type BootResult = { ps: PubSub; lastOpts: IClientOptions | null };

async function boot(
  fake: FakeMqttClient,
  extra?: Partial<Parameters<typeof createMqttPubSub>[0]>
): Promise<BootResult> {
  let lastOpts: IClientOptions | null = null;
  const ps = createMqttPubSub({
    url: 'ws://x/mqtt',
    auth: async () => ({ username: 'u', password: 'p' }),
    clientIdPrefix: 'device-1',
    timers: wallTimers,
    random: () => 0,
    logger: createNoopLogger(),
    connectFn: (_url: string, opts: IClientOptions) => {
      lastOpts = opts;
      return fake as unknown as MqttClient;
    },
    ...extra,
  });
  await waitUntil(() => fake.listenerCount('connect') > 0);
  fake.simulateConnect();
  await waitUntil(() => ps.status() === 'connected');
  return { ps, lastOpts };
}

describe('createMqttPubSub', () => {
  test('connects MQTT 5 with a persistent stable session', async () => {
    const fake = new FakeMqttClient();
    const { ps, lastOpts } = await boot(fake);
    expect(lastOpts).toMatchObject({
      clientId: 'device-1',
      protocolVersion: 5,
      clean: false,
      reconnectPeriod: 0,
      properties: { sessionExpiryInterval: MQTT_SESSION_EXPIRY_SEC },
    });
    ps.close();
  });

  test('validates, refcounts, and publishes at QoS 1', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    await expect(ps.publish('bad/topic', 1)).rejects.toThrow();
    expect(fake.publishCalls).toHaveLength(0);

    const unsubscribe1 = ps.subscribe('topic-a', () => undefined);
    const unsubscribe2 = ps.subscribe('topic-a', () => undefined);
    expect(fake.subscribeCalls).toEqual([
      { topic: 'topic-a', qos: MQTT_PUBSUB_QOS },
    ]);
    unsubscribe1();
    expect(fake.unsubscribeCalls).toHaveLength(0);
    unsubscribe2();
    expect(fake.unsubscribeCalls).toEqual(['topic-a']);

    await ps.publish('topic-a', { ok: true });
    expect(fake.publishCalls[0]).toMatchObject({
      topic: 'topic-a',
      payload: JSON.stringify({ ok: true }),
      qos: MQTT_PUBSUB_QOS,
      retain: false,
    });
    ps.close();
  });

  test('resubscribes and refreshes auth after reconnect', async () => {
    const fakes: FakeMqttClient[] = [];
    let authCalls = 0;
    const optsList: IClientOptions[] = [];
    const ps = createMqttPubSub({
      url: 'ws://x/mqtt',
      auth: async () => {
        authCalls += 1;
        return { username: 'u', password: `p-${authCalls}` };
      },
      clientIdPrefix: 'stable-id',
      timers: wallTimers,
      random: () => 0,
      logger: createNoopLogger(),
      reconnect: { baseMs: 1, maxMs: 1 },
      connectFn: (_url, opts) => {
        optsList.push(opts);
        const fake = new FakeMqttClient();
        fakes.push(fake);
        queueMicrotask(() => fake.simulateConnect());
        return fake as unknown as MqttClient;
      },
    });
    ps.subscribe('keep', () => undefined);
    await waitUntil(() => ps.status() === 'connected');
    expect(authCalls).toBe(1);
    expect(optsList[0]).toMatchObject({
      clientId: 'stable-id',
      password: 'p-1',
    });
    expect(fakes[0]?.subscribeCalls).toEqual([
      { topic: 'keep', qos: MQTT_PUBSUB_QOS },
    ]);

    fakes[0]?.emit('close');
    await waitUntil(() => optsList.length >= 2);
    expect(authCalls).toBe(2);
    expect(optsList[1]).toMatchObject({
      clientId: 'stable-id',
      clean: false,
      password: 'p-2',
    });
    ps.close();
  });

  test('contains handler errors and terminally closes', async () => {
    const fake = new FakeMqttClient();
    const warnings: string[] = [];
    const logger: Logger = {
      ...createNoopLogger(),
      warn: (msg) => warnings.push(msg),
    };
    const { ps } = await boot(fake, { logger });
    const received = mock(() => undefined);
    ps.subscribe('events', () => {
      throw new Error('boom');
    });
    ps.subscribe('events', received);
    fake.emit('message', 'events', Buffer.from(JSON.stringify({ n: 1 })));
    expect(received).toHaveBeenCalledWith({ n: 1 });
    expect(warnings).toEqual(['handler error contained']);

    ps.close();
    ps.close();
    expect(fake.endCalls[0]).toEqual({
      force: false,
      opts: { reasonCode: 0, properties: { sessionExpiryInterval: 0 } },
    });
    expect(ps.status()).toBe('down');
    await expect(ps.publish('events', 1)).rejects.toThrow();
  });
});
