import { describe, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { IClientOptions, MqttClient } from 'mqtt';
import { createEmqxPubSub } from './create-emqx-pubsub';

class FakeMqttClient extends EventEmitter {
  connected = false;
  readonly subscribeCalls: string[] = [];
  readonly unsubscribeCalls: string[] = [];
  readonly publishCalls: { topic: string; payload: string }[] = [];
  ended = false;

  subscribe(topic: string): this {
    this.subscribeCalls.push(topic);
    return this;
  }

  unsubscribe(topic: string): this {
    this.unsubscribeCalls.push(topic);
    return this;
  }

  publish(
    topic: string,
    payload: string | Buffer,
    _opts: unknown,
    cb?: (err?: Error) => void
  ): this {
    this.publishCalls.push({ topic, payload: String(payload) });
    cb?.();
    return this;
  }

  end(_force?: boolean): this {
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
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('waitUntil timed out');
}

async function boot(
  fake: FakeMqttClient,
  extra?: Partial<Parameters<typeof createEmqxPubSub>[0]>
): Promise<PubSub> {
  const ps = createEmqxPubSub({
    url: 'wss://x/mqtt',
    auth: async () => ({ username: 'u', password: 'p' }),
    clientIdPrefix: 't',
    connectFn: (_url: string, _opts: IClientOptions) =>
      fake as unknown as MqttClient,
    ...extra,
  });
  await waitUntil(() => fake.listenerCount('connect') > 0);
  fake.simulateConnect();
  await waitUntil(() => ps.status() === 'connected');
  return ps;
}

describe('createEmqxPubSub', () => {
  test('rejects invalid topic before wire', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
    await expect(ps.publish('a/b', 1)).rejects.toThrow();
    expect(fake.publishCalls).toHaveLength(0);
    ps.close();
  });

  test('refcounts subscribe unsubscribe on wire', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
    const u1 = ps.subscribe('topic-a', () => undefined);
    const u2 = ps.subscribe('topic-a', () => undefined);
    expect(fake.subscribeCalls).toEqual(['topic-a']);
    u1();
    expect(fake.unsubscribeCalls).toEqual([]);
    u2();
    expect(fake.unsubscribeCalls).toEqual(['topic-a']);
    ps.close();
  });

  test('resubscribes desired set on reconnect connect', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
    ps.subscribe('keep', () => undefined);
    expect(fake.subscribeCalls).toEqual(['keep']);
    fake.subscribeCalls.length = 0;
    fake.simulateConnect();
    expect(fake.subscribeCalls).toEqual(['keep']);
    ps.close();
  });

  test('publish uses qos0 retain false', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
    await ps.publish('t1', { n: 1 });
    expect(fake.publishCalls[0]).toEqual({
      topic: 't1',
      payload: JSON.stringify({ n: 1 }),
    });
    ps.close();
  });

  test('close is terminal and ends client', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
    ps.close();
    ps.close();
    expect(fake.ended).toBe(true);
    expect(ps.status()).toBe('down');
    await expect(ps.publish('t', 1)).rejects.toThrow();
  });

  test('handler errors are contained', async () => {
    const fake = new FakeMqttClient();
    const ps = await boot(fake);
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
    const ps = await boot(fake, { auth });
    expect(auth).toHaveBeenCalled();
    ps.close();
  });
});
