import { expect, test } from 'bun:test';

import {
  awaitSubscriptionLive,
  collect,
  expectRejects,
  waitMs,
  waitUntil,
} from './contract-helpers';
import type { PubSubContractEnv } from './contract-types';
import { InMemoryPubSub } from './in-memory';

export function registerCoreContractTests(env: () => PubSubContractEnv): void {
  registerDeliveryTests(env);
  registerFanoutTests(env);
  registerValidationTests(env);
  registerEdgeTests(env);
}

function registerDeliveryTests(env: () => PubSubContractEnv): void {
  test('publish-reaches-subscriber', async () => {
    const { make } = env();
    const a = await make();
    const { items, unsub } = collect(a, 't1');
    await a.publish('t1', { n: 1 });
    await waitUntil(() => items.length === 1);
    expect(items[0]).toEqual({ n: 1 });
    unsub();
    a.close();
  });

  test('publish-before-subscribe-is-dropped', async () => {
    const { make } = env();
    const a = await make();
    await a.publish('early', 1);
    const { items, unsub } = collect(a, 'early');
    await a.publish('early', 2);
    await waitUntil(() => items.length === 1);
    expect(items).toEqual([2]);
    unsub();
    a.close();
  });

  test('unsubscribe-stops-delivery', async () => {
    const { make } = env();
    const a = await make();
    const { items, unsub } = collect(a, 'u');
    await a.publish('u', 1);
    await waitUntil(() => items.length === 1);
    unsub();
    await a.publish('u', 2);
    await waitMs(50);
    expect(items).toEqual([1]);
    a.close();
  });

  test('self-publish-delivery', async () => {
    const { make } = env();
    const a = await make();
    const { items, unsub } = collect(a, 'self');
    await a.publish('self', true);
    await waitUntil(() => items.length === 1);
    expect(items[0]).toBe(true);
    unsub();
    a.close();
  });
}

function registerFanoutTests(env: () => PubSubContractEnv): void {
  test('refcounted-handlers', async () => {
    const { make } = env();
    const a = await make();
    const got: unknown[] = [];
    const u1 = a.subscribe('r', (d) => got.push(['a', d]));
    const u2 = a.subscribe('r', (d) => got.push(['b', d]));
    await a.publish('r', 1);
    await waitUntil(() => got.length === 2);
    u1();
    await a.publish('r', 2);
    await waitUntil(() => got.length === 3);
    expect(got).toEqual([
      ['a', 1],
      ['b', 1],
      ['b', 2],
    ]);
    u2();
    a.close();
  });

  test('multiple-topics-independent', async () => {
    const { make } = env();
    const a = await make();
    const x = collect(a, 'x');
    const y = collect(a, 'y');
    await a.publish('x', 1);
    await a.publish('y', 2);
    await waitUntil(() => x.items.length === 1 && y.items.length === 1);
    expect(x.items).toEqual([1]);
    expect(y.items).toEqual([2]);
    x.unsub();
    y.unsub();
    a.close();
  });

  test('two-instances-both-receive', async () => {
    const { make } = env();
    const a = await make();
    const b = await make();
    const aa = collect(a, 'fan');
    const bb = collect(b, 'fan');
    // `b` hears `a` only once its own SUBSCRIBE has landed. Each barrier's
    // probe may still echo to the other instance later, so assert on `hi`.
    await awaitSubscriptionLive(a, 'fan', aa.items);
    await awaitSubscriptionLive(b, 'fan', bb.items);
    await a.publish('fan', 'hi');
    const hi = (items: unknown[]): unknown[] =>
      items.filter((item) => item === 'hi');
    await waitUntil(
      () => hi(aa.items).length === 1 && hi(bb.items).length === 1,
      5000
    );
    expect(hi(aa.items)).toEqual(['hi']);
    expect(hi(bb.items)).toEqual(['hi']);
    aa.unsub();
    bb.unsub();
    a.close();
    b.close();
  });
}

function registerValidationTests(env: () => PubSubContractEnv): void {
  test('invalid-topic-rejected', async () => {
    const { make } = env();
    const a = await make();
    const bad = ['a/b', 'a+b', 'a#b', 'Bad', 'a b', 'x'.repeat(129)];
    for (const t of bad) {
      await expectRejects(() => a.publish(t, 1));
      expect(() => a.subscribe(t, () => undefined)).toThrow();
    }
    a.close();
  });

  test('oversized-payload-rejected', async () => {
    const { make } = env();
    const a = await make();
    const big = 'x'.repeat(33 * 1024);
    await expectRejects(() => a.publish('big', big));
    a.close();
  });
}

function registerEdgeTests(env: () => PubSubContractEnv): void {
  test('malformed-inbound-dropped', async () => {
    const e = env();
    const a = await e.make();
    const { items, unsub } = collect(a, 'bad');
    if (e.injectMalformedInbound) {
      await e.injectMalformedInbound(a, 'bad');
    } else if (a instanceof InMemoryPubSub) {
      a.deliverRawForTest('bad', 'not-json{{{');
    } else {
      unsub();
      a.close();
      throw new Error('malformed-inbound: injectMalformedInbound required');
    }
    await waitMs(50);
    expect(items).toEqual([]);
    expect(a.status()).not.toBe('down');
    unsub();
    a.close();
  });

  test('handler-error-contained', async () => {
    const { make } = env();
    const a = await make();
    const ok: unknown[] = [];
    a.subscribe('err', () => {
      throw new Error('boom');
    });
    a.subscribe('err', (d) => ok.push(d));
    await a.publish('err', 1);
    await waitUntil(() => ok.length === 1);
    expect(ok).toEqual([1]);
    a.close();
  });

  test('close-is-terminal', async () => {
    const { make } = env();
    const a = await make();
    a.close();
    a.close();
    expect(a.status()).toBe('down');
    await expectRejects(() => a.publish('c', 1));
    expect(() => a.subscribe('c', () => undefined)).toThrow();
    const unsub = a.onStatus(() => undefined);
    unsub();
  });
}
