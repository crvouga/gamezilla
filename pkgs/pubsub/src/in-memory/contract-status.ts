import { expect, test } from 'bun:test';
import { PubSubNotSupportedError } from '../pubsub-not-supported-error';
import {
  awaitSubscriptionLive,
  collect,
  expectRejects,
  waitUntil,
} from './contract-helpers';
import type { PubSubContractEnv } from './contract-types';

export function registerStatusContractTests(
  env: () => PubSubContractEnv
): void {
  test('status-transitions', async () => {
    const e = env();
    if (!e.disruptTransport) {
      // Loud skip — adapter did not provide disruptTransport.
      console.warn(
        '[pubsub contract] status-transitions skipped (no disruptTransport)'
      );
      return;
    }
    const a = await e.make();
    const seen: string[] = [];
    const unsub = a.onStatus((s) => seen.push(s));
    expect(a.status()).toBe('connected');
    await e.disruptTransport(a);
    // Read the transition from the event log, not a poll: a fast backoff can
    // drop and reconnect between two polls of `status()`.
    const dropped = (): boolean =>
      seen.some((s) => s === 'down' || s === 'connecting');
    await waitUntil(dropped, 5000);
    expect(dropped()).toBe(true);
    await waitUntil(() => a.status() === 'connected', 15_000);
    expect(a.status()).toBe('connected');
    expect(seen.length).toBeGreaterThan(0);
    unsub();
    a.close();
  });

  test('resubscribe-after-reconnect', async () => {
    const e = env();
    if (!e.disruptTransport) {
      console.warn(
        '[pubsub contract] resubscribe-after-reconnect skipped (no disruptTransport)'
      );
      return;
    }
    const a = await e.make();
    const { items, unsub } = collect(a, 're');
    await a.publish('re', 1);
    await waitUntil(() => items.length === 1);
    await e.disruptTransport(a);
    await waitUntil(() => a.status() === 'connected', 15_000);
    await a.publish('re', 2);
    await waitUntil(() => items.length === 2, 5000);
    expect(items).toEqual([1, 2]);
    unsub();
    a.close();
  });
}

export function registerPublishOnlyContractTests(
  env: () => PubSubContractEnv
): void {
  test('publish-only-publish-reaches-duplex-subscriber', async () => {
    const e = env();
    if (!e.makePublishOnly) return;
    const sub = await e.make();
    const pub = await e.makePublishOnly();
    const { items, unsub } = collect(sub, 'http');
    await awaitSubscriptionLive(sub, 'http', items);
    await pub.publish('http', { via: 'http' });
    await waitUntil(() => items.length === 1, 5000);
    expect(items[0]).toEqual({ via: 'http' });
    unsub();
    sub.close();
    pub.close();
  });

  test('publish-only-subscribe-throws-not-supported', async () => {
    const e = env();
    if (!e.makePublishOnly) return;
    const pub = await e.makePublishOnly();
    expect(() => pub.subscribe('x', () => undefined)).toThrow(
      PubSubNotSupportedError
    );
    expect(pub.status()).toBe('connected');
    const unsub = pub.onStatus(() => undefined);
    unsub();
    pub.close();
  });

  test('publish-only-validation-identical', async () => {
    const e = env();
    if (!e.makePublishOnly) return;
    const pub = await e.makePublishOnly();
    await expectRejects(() => pub.publish('a/b', 1));
    await expectRejects(() => pub.publish('big', 'x'.repeat(33 * 1024)));
    pub.close();
  });
}
