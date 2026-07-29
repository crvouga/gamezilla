import { describe, expect, test } from 'bun:test';

import type { SyncStreamSubscription } from '../client/sync-stream-subscription';
import { subscribeAll } from '../client/use-sync-engine-subscriptions';

describe('sync stream subscription readiness', () => {
  test('subscribes every stream before waiting for first sync', async () => {
    const order: string[] = [];
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    const result = await subscribeAll({
      subscribe: async (stream, params) => {
        order.push(`subscribe:${stream}:${JSON.stringify(params)}`);
        return {
          unsubscribe: () => {
            order.push(`unsub:${stream}`);
          },
          waitForFirstSync: async () => {
            order.push(`wait:${stream}`);
          },
        };
      },
      specs: [
        { stream: 'chess_puzzles', params: { band: 0 } },
        { stream: 'chess_puzzles', params: { band: 1 } },
      ],
      isCancelled: () => false,
      liveUnsubs,
      abort: abort.signal,
    });
    expect(result.ready).toBe(true);
    expect(order).toEqual([
      'subscribe:chess_puzzles:{"band":0}',
      'subscribe:chess_puzzles:{"band":1}',
      'wait:chess_puzzles',
      'wait:chess_puzzles',
    ]);
    expect(liveUnsubs).toHaveLength(2);
    for (const unsub of liveUnsubs) unsub();
    expect(order.slice(-2)).toEqual([
      'unsub:chess_puzzles',
      'unsub:chess_puzzles',
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
      subscribe: async () =>
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
        }) satisfies SyncStreamSubscription,
      specs: [
        { stream: 'spaces', params: {} },
      ],
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
      subscribe: async () => {
        cancelled = true;
        return {
          unsubscribe: () => undefined,
          waitForFirstSync: async () => undefined,
        };
      },
      specs: [
        { stream: 'spaces', params: {} },
      ],
      isCancelled: () => cancelled,
      liveUnsubs,
      abort: abort.signal,
    });
    expect(result.ready).toBe(false);
    expect(liveUnsubs).toHaveLength(0);
  });
});
