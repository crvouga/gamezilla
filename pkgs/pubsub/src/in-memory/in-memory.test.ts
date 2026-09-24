import { describe, expect, test } from 'bun:test';
import { createNoopLogger } from '@pkgs/logger';
import { PubSubClosedError } from '../pubsub-closed-error';
import { PubSubNotSupportedError } from '../pubsub-not-supported-error';
import {
  createInMemoryBus,
  createInMemoryPublishOnlyPubSub,
  createInMemoryPubSub,
  InMemoryPubSub,
} from './in-memory';

const logger = createNoopLogger();

describe('createInMemoryPubSub', () => {
  test('routes through encode decode', async () => {
    const ps = createInMemoryPubSub({ logger });
    const got: unknown[] = [];
    ps.subscribe('t', (d) => got.push(d));
    await ps.publish('t', { x: 1 });
    expect(got).toEqual([{ x: 1 }]);
    ps.close();
  });

  test('close is terminal', async () => {
    const ps = createInMemoryPubSub({ logger });
    ps.close();
    await expect(ps.publish('t', 1)).rejects.toBeInstanceOf(PubSubClosedError);
  });

  test('remaking factory returns open instance after close', async () => {
    const bus = createInMemoryBus();
    let live: ReturnType<typeof createInMemoryPubSub> | null = null;
    const createPubSub = () => {
      live?.close();
      live = createInMemoryPubSub({ bus, logger });
      return live;
    };
    const first = createPubSub();
    first.close();
    const second = createPubSub();
    expect(second).not.toBe(first);
    const got: unknown[] = [];
    second.subscribe('t', (d) => got.push(d));
    const peer = createInMemoryPubSub({ bus, offlineBuffer: false, logger });
    await peer.publish('t', { ok: true });
    expect(got).toEqual([{ ok: true }]);
    peer.close();
    second.close();
  });

  test('returning a closed singleton fails subscribe', () => {
    const singleton = createInMemoryPubSub({ logger });
    singleton.close();
    expect(() => singleton.subscribe('t', () => undefined)).toThrow(
      PubSubClosedError
    );
  });

  test('buffers while down and flushes on reconnect', async () => {
    const bus = createInMemoryBus();
    const pub = createInMemoryPubSub({ bus, offlineBuffer: false, logger });
    const sub = new InMemoryPubSub({ bus, maxBuffer: 8, logger });
    const got: unknown[] = [];
    sub.subscribe('t', (d) => got.push(d));
    sub.setStatusForTest('down');
    await pub.publish('t', { n: 1 });
    await pub.publish('t', { n: 2 });
    expect(got).toEqual([]);
    expect(sub.bufferedCountForTest()).toBe(2);
    sub.setStatusForTest('connected');
    expect(got).toEqual([{ n: 1 }, { n: 2 }]);
    expect(sub.bufferedCountForTest()).toBe(0);
    pub.close();
    sub.close();
  });

  test('drops oldest when buffer overflows', async () => {
    const bus = createInMemoryBus();
    const pub = createInMemoryPubSub({ bus, offlineBuffer: false, logger });
    const sub = new InMemoryPubSub({ bus, maxBuffer: 2, logger });
    const got: unknown[] = [];
    sub.subscribe('t', (d) => got.push(d));
    sub.setStatusForTest('down');
    await pub.publish('t', { n: 1 });
    await pub.publish('t', { n: 2 });
    await pub.publish('t', { n: 3 });
    expect(sub.bufferedCountForTest()).toBe(2);
    sub.setStatusForTest('connected');
    expect(got).toEqual([{ n: 2 }, { n: 3 }]);
    pub.close();
    sub.close();
  });

  test('publish-only rejects subscribe', () => {
    const bus = createInMemoryBus();
    const only = createInMemoryPublishOnlyPubSub({ bus, logger });
    expect(() => only.subscribe('t', () => undefined)).toThrow(
      PubSubNotSupportedError
    );
    only.close();
  });
});
