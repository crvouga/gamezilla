import { describe, expect, test } from 'bun:test';

import { createSubscribeQueries } from '../client/subscribe-queries';
import type { QuerySubscription } from '../client/subscription-runtime';

describe('createSubscribeQueries', () => {
  test('subscribes every query before waiting for first sync', async () => {
    const order: string[] = [];
    const subscribeQueries = createSubscribeQueries((name, params) => {
      order.push(`subscribe:${name}:${JSON.stringify(params)}`);
      return {
        unsubscribe: () => {
          order.push(`unsub:${name}`);
        },
        waitForFirstSync: async () => {
          order.push(`wait:${name}`);
        },
      };
    });
    const handle = subscribeQueries([
      { name: 'chessPuzzlePool', params: { band: 0 } },
      { name: 'chessPuzzlePool', params: { band: 1 } },
    ]);
    expect(await handle.ready).toBe(true);
    expect(order).toEqual([
      'subscribe:chessPuzzlePool:{"band":0}',
      'subscribe:chessPuzzlePool:{"band":1}',
      'wait:chessPuzzlePool',
      'wait:chessPuzzlePool',
    ]);
    handle.unsubscribe();
    expect(order.slice(-2)).toEqual([
      'unsub:chessPuzzlePool',
      'unsub:chessPuzzlePool',
    ]);
  });

  test('unsubscribe tears down while wait is in flight', async () => {
    let unsubscribed = false;
    let releaseWait: (() => void) | undefined;
    let notifyWaitStarted: (() => void) | undefined;
    const waitGate = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    const waitStarted = new Promise<void>((resolve) => {
      notifyWaitStarted = resolve;
    });
    const subscribeQueries = createSubscribeQueries(
      () =>
        ({
          unsubscribe: () => {
            unsubscribed = true;
          },
          waitForFirstSync: async () => {
            notifyWaitStarted?.();
            await waitGate;
          },
        }) satisfies QuerySubscription
    );
    const handle = subscribeQueries([{ name: 'mySpaces', params: {} }]);
    await waitStarted;
    handle.unsubscribe();
    expect(unsubscribed).toBe(true);
    releaseWait?.();
    expect(await handle.ready).toBe(false);
  });

  test('empty specs resolve ready immediately', async () => {
    const subscribeQueries = createSubscribeQueries(() => {
      throw new Error('should not subscribe');
    });
    const handle = subscribeQueries([]);
    expect(await handle.ready).toBe(true);
  });
});
