import { describe, test } from 'bun:test';
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
