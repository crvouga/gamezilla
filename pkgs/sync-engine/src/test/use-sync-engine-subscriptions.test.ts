import { describe, expect, test } from 'bun:test';

import type { QuerySubscription } from '../client/subscription-runtime';
import { subscribeAll } from '../client/use-sync-engine-subscriptions';

describe('query subscription readiness', () => {
  test('subscribes every query before waiting for first sync', async () => {
    const order: string[] = [];
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    const result = await subscribeAll({
      subscribe: (name, params) => {
        order.push(`subscribe:${name}:${JSON.stringify(params)}`);
        return {
          unsubscribe: () => {
            order.push(`unsub:${name}`);
          },
          waitForFirstSync: async () => {
            order.push(`wait:${name}`);
          },
        };
      },
      specs: [
        { name: 'chessPuzzlePool', params: { band: 0 } },
        { name: 'chessPuzzlePool', params: { band: 1 } },
      ],
      isCancelled: () => false,
      liveUnsubs,
      abort: abort.signal,
    });
    expect(result.ready).toBe(true);
    expect(order).toEqual([
      'subscribe:chessPuzzlePool:{"band":0}',
      'subscribe:chessPuzzlePool:{"band":1}',
      'wait:chessPuzzlePool',
      'wait:chessPuzzlePool',
    ]);
    expect(liveUnsubs).toHaveLength(2);
    for (const unsub of liveUnsubs) unsub();
    expect(order.slice(-2)).toEqual([
      'unsub:chessPuzzlePool',
      'unsub:chessPuzzlePool',
    ]);
  });

  test('registers live unsubs before wait so cancel can tear down', async () => {
    let unsubscribed = false;
    let releaseWait: (() => void) | undefined;
    let notifyWaitStarted: (() => void) | undefined;
    const waitGate = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    const waitStarted = new Promise<void>((resolve) => {
      notifyWaitStarted = resolve;
    });
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    let cancelled = false;
    const subscribePromise = subscribeAll({
      subscribe: () =>
        ({
          unsubscribe: () => {
            unsubscribed = true;
          },
          waitForFirstSync: async (signal?: AbortSignal) => {
            // waitForFirstSync runs only after liveUnsubs.push in subscribeAll.
            notifyWaitStarted?.();
            if (signal?.aborted) return;
            await new Promise<void>((resolve) => {
              const onAbort = (): void => resolve();
              signal?.addEventListener('abort', onAbort, { once: true });
              void waitGate.then(() => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
              });
            });
          },
        }) satisfies QuerySubscription,
      specs: [{ name: 'mySpaces', params: {} }],
      isCancelled: () => cancelled,
      liveUnsubs,
      abort: abort.signal,
    });
    await waitStarted;
    expect(liveUnsubs).toHaveLength(1);
    cancelled = true;
    abort.abort();
    for (const unsub of liveUnsubs) unsub();
    expect(unsubscribed).toBe(true);
    releaseWait?.();
    const result = await subscribePromise;
    expect(result.ready).toBe(false);
  });

  test('does not mark ready when cancelled mid-subscribe', async () => {
    let cancelled = false;
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    const result = await subscribeAll({
      subscribe: () => {
        cancelled = true;
        return {
          unsubscribe: () => undefined,
          waitForFirstSync: async () => undefined,
        };
      },
      specs: [{ name: 'mySpaces', params: {} }],
      isCancelled: () => cancelled,
      liveUnsubs,
      abort: abort.signal,
    });
    expect(result.ready).toBe(false);
    expect(liveUnsubs).toHaveLength(0);
  });
});
