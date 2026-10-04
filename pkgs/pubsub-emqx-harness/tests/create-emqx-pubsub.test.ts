import { describe, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { HarnessClockBundle } from '@pkgs/clock-shared/harness-clock';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import {
  createEmqxPubSub,
  EMQX_PUBSUB_QOS,
  EMQX_SESSION_EXPIRY_SEC,
} from '@pkgs/pubsub-emqx-shared/create-emqx-pubsub';
import type { PubSub } from '@pkgs/pubsub-shared/interface';
import type { IClientOptions, MqttClient } from 'mqtt';

/** Pinned jitter source: reconnect backoff is deterministic. */
const random = (): number => 0;

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

const SETTLE_STEPS = 3000;

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

/**
 * Drain microtasks, then step virtual time 1 ms, until `pred` holds. The fake
 * client lives in-process, so no wall time is ever needed.
 */
async function waitUntil(
  harness: HarnessClockBundle,
  pred: () => boolean
): Promise<void> {
  for (let step = 0; step < SETTLE_STEPS; step += 1) {
    await flushMicrotasks();
    if (pred()) return;
    harness.clock.advance(1);
  }
  throw new Error(`waitUntil timed out at t=${harness.clock.now()}ms`);
}

type BootResult = {
  ps: PubSub;
  lastOpts: IClientOptions | null;
};

async function boot(
  fake: FakeMqttClient,
  extra?: Partial<Parameters<typeof createEmqxPubSub>[0]>
): Promise<BootResult> {
  let lastOpts: IClientOptions | null = null;
  const harness = createHarnessClock();
  const ps = createEmqxPubSub({
    url: 'wss://x/mqtt',
    auth: async () => ({ username: 'u', password: 'p' }),
    clientIdPrefix: 'device-1',
    timers: harness.timers,
    random,
    logger: createNoopLogger(),
    connectFn: (_url: string, opts: IClientOptions) => {
      lastOpts = opts;
      return fake as unknown as MqttClient;
    },
    ...extra,
  });
  await waitUntil(harness, () => fake.listenerCount('connect') > 0);
  fake.simulateConnect();
  await waitUntil(harness, () => ps.status() === 'connected');
  return { ps, lastOpts };
}

describe('createEmqxPubSub', () => {
  test('connects MQTT5 cleanStart false with session expiry and stable clientId', async () => {
    const fake = new FakeMqttClient();
    const { ps, lastOpts } = await boot(fake);
    expect(lastOpts?.clientId).toBe('device-1');
    expect(lastOpts?.protocolVersion).toBe(5);
    expect(lastOpts?.clean).toBe(false);
    expect(lastOpts?.properties?.sessionExpiryInterval).toBe(
      EMQX_SESSION_EXPIRY_SEC
    );
    ps.close();
  });

  test('rejects invalid topic before wire', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    await expect(ps.publish('a/b', 1)).rejects.toThrow();
    expect(fake.publishCalls).toHaveLength(0);
    ps.close();
  });

  test('refcounts subscribe unsubscribe on wire', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    const u1 = ps.subscribe('topic-a', () => undefined);
    const u2 = ps.subscribe('topic-a', () => undefined);
    expect(fake.subscribeCalls).toEqual([
      { topic: 'topic-a', qos: EMQX_PUBSUB_QOS },
    ]);
    u1();
    expect(fake.unsubscribeCalls).toEqual([]);
    u2();
    expect(fake.unsubscribeCalls).toEqual(['topic-a']);
    ps.close();
  });

  test('resubscribes desired set on reconnect connect', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    ps.subscribe('keep', () => undefined);
    expect(fake.subscribeCalls).toEqual([
      { topic: 'keep', qos: EMQX_PUBSUB_QOS },
    ]);
    fake.subscribeCalls.length = 0;
    fake.simulateConnect();
    expect(fake.subscribeCalls).toEqual([
      { topic: 'keep', qos: EMQX_PUBSUB_QOS },
    ]);
    ps.close();
  });

  test('publish uses qos1 retain false', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    await ps.publish('t1', { n: 1 });
    expect(fake.publishCalls[0]).toEqual({
      topic: 't1',
      payload: JSON.stringify({ n: 1 }),
      qos: EMQX_PUBSUB_QOS,
      retain: false,
    });
    ps.close();
  });

  test('close discards session and ends client', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    ps.close();
    ps.close();
    expect(fake.ended).toBe(true);
    expect(fake.endCalls[0]?.force).toBe(false);
    expect(fake.endCalls[0]?.opts).toEqual({
      reasonCode: 0,
      properties: { sessionExpiryInterval: 0 },
    });
    expect(ps.status()).toBe('down');
    await expect(ps.publish('t', 1)).rejects.toThrow();
  });

  test('handler errors are contained', async () => {
    const fake = new FakeMqttClient();
    const { ps } = await boot(fake);
    const ok = mock(() => undefined);
    ps.subscribe('e', () => {
      throw new Error('boom');
    });
    ps.subscribe('e', ok);
    fake.emit('message', 'e', Buffer.from(JSON.stringify(1)));
    expect(ok).toHaveBeenCalledWith(1);
    ps.close();
  });

  test('auth is called on connect', async () => {
    const fake = new FakeMqttClient();
    const auth = mock(async () => ({ username: 'u', password: 'p' }));
    const { ps } = await boot(fake, { auth });
    expect(auth).toHaveBeenCalled();
    ps.close();
  });

  test('reconnect reuses the same clientId', async () => {
    const fakes: FakeMqttClient[] = [];
    const optsList: IClientOptions[] = [];
    const harness = createHarnessClock();
    const ps = createEmqxPubSub({
      url: 'wss://x/mqtt',
      auth: async () => ({ username: 'u', password: 'p' }),
      clientIdPrefix: 'stable-id',
      timers: harness.timers,
      random,
      logger: createNoopLogger(),
      reconnect: { baseMs: 1, maxMs: 1 },
      connectFn: (_url, opts) => {
        optsList.push(opts);
        const fake = new FakeMqttClient();
        fakes.push(fake);
        queueMicrotask(() => {
          fake.connected = true;
          fake.emit('connect');
        });
        return fake as unknown as MqttClient;
      },
    });
    await waitUntil(harness, () => ps.status() === 'connected');
    expect(optsList[0]?.clientId).toBe('stable-id');

    fakes[0]!.emit('close');
    await waitUntil(harness, () => optsList.length >= 2);
    expect(optsList[1]?.clientId).toBe('stable-id');
    expect(optsList[1]?.clean).toBe(false);
    ps.close();
  });
});
