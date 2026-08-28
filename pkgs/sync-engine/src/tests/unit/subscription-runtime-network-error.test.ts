import { describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import { HttpNetworkError } from '@pkgs/http-client';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { SubscriptionRuntime } from '../../client/subscription-runtime';

const timers: Timers = {
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

function stubDb(): SqlClient {
  return {
    query: async () => [],
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    connect: async () => undefined,
    disconnect: async () => undefined,
  } as unknown as SqlClient;
}

describe('SubscriptionRuntime first sync', () => {
  test('stopAndDrain waits for an in-flight sweep to finish', async () => {
    let markStarted: () => void = () => undefined;
    let releaseSweep: () => void = () => undefined;
    const sweepStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const sweepGate = new Promise<void>((resolve) => {
      releaseSweep = resolve;
    });
    const runtime = new SubscriptionRuntime({
      db: stubDb(),
      postQueries: async () => {
        markStarted();
        await sweepGate;
        return [];
      },
      timers,
      coalesceMs: 0,
      reconcileIntervalMs: 0,
      getMergeDeps: () => {
        throw new Error('merge unused');
      },
      onError: () => undefined,
      onSynced: () => undefined,
    });
    runtime.subscribe({ name: 'ownUser', params: {} });
    runtime.start();
    await sweepStarted;
    let drained = false;
    const drain = runtime.stopAndDrain().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    releaseSweep();
    await drain;
    expect(drained).toBe(true);
  });

  test('waitForFirstSync resolves when postQueries throws HttpNetworkError', async () => {
    const runtime = new SubscriptionRuntime({
      db: stubDb(),
      postQueries: async () => {
        throw new HttpNetworkError('Failed to fetch');
      },
      timers,
      reconcileIntervalMs: 0,
      getMergeDeps: () => {
        throw new Error('merge unused on network error');
      },
      onError: () => undefined,
      onSynced: () => undefined,
    });
    const sub = runtime.subscribe({ name: 'ownUser', params: {} });
    runtime.start();
    await sub.waitForFirstSync();
  });
});
