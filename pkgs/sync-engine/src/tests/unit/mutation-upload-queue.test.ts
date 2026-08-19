import { describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import { HttpNetworkError } from '@pkgs/http-client';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { MutationUploadQueue } from '../../client/mutation-upload-queue';
import { createTableChangeBus } from '../../queries/client/table-change-bus';

const timers: Timers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

const row = {
  id: 'm1',
  name: 'setNote',
  args: '{}',
  client_id: 'c1',
  seq: 1,
  created_at: '2020-01-01T00:00:00.000Z',
};

function stubDb(pending: (typeof row)[]): SqlClient {
  return {
    query: async () => pending,
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn({
        query: async () => [],
        run: async () => ({ changes: 1, lastInsertRowid: 0 }),
      } as unknown as SqlClient),
    connect: async () => undefined,
    disconnect: async () => undefined,
  } as unknown as SqlClient;
}

function waitUntil(args: {
  readonly isAvailable: () => boolean;
  readonly gate: () => Promise<void>;
  readonly signal?: AbortSignal;
}): Promise<void> {
  if (args.isAvailable()) return Promise.resolve();
  if (args.signal?.aborted === true) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      args.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    args.signal?.addEventListener('abort', onAbort);
    void args.gate().then(() => {
      args.signal?.removeEventListener('abort', onAbort);
      resolve();
    }, reject);
  });
}

describe('MutationUploadQueue origin availability', () => {
  test('does not postBatch until availability; one attempt after it returns', async () => {
    const pending = [row];
    let available = false;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    const queue = new MutationUploadQueue({
      db: stubDb(pending),
      bus: createTableChangeBus(),
      clientId: () => 'c1',
      waitUntilAvailable: (signal) =>
        waitUntil({
          isAvailable: () => available,
          gate: () => gate,
          ...(signal != null ? { signal } : {}),
        }),
      postBatch: async () => {
        posts += 1;
        pending.length = 0;
        return {
          ok: true,
          ackSeq: 1,
          verdicts: [{ mutationId: 'm1', status: 'applied' }],
        };
      },
      onError: () => undefined,
      timers,
      now: () => 0,
    });
    queue.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(posts).toBe(0);
    available = true;
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(posts).toBe(1);
    await queue.stop();
  });

  test('HttpNetworkError waits for availability instead of posting again immediately', async () => {
    const pending = [row];
    let available = true;
    let release: () => void = () => undefined;
    let gate = Promise.resolve();
    let posts = 0;
    const queue = new MutationUploadQueue({
      db: stubDb(pending),
      bus: createTableChangeBus(),
      clientId: () => 'c1',
      waitUntilAvailable: (signal) =>
        waitUntil({
          isAvailable: () => available,
          gate: () => gate,
          ...(signal != null ? { signal } : {}),
        }),
      postBatch: async () => {
        posts += 1;
        available = false;
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        throw new HttpNetworkError('down');
      },
      onError: () => undefined,
      timers,
      now: () => 0,
    });
    queue.start();
    for (let i = 0; i < 20 && posts === 0; i += 1) {
      await Promise.resolve();
    }
    expect(posts).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(posts).toBe(1);
    available = true;
    release();
    for (let i = 0; i < 20 && posts < 2; i += 1) {
      await Promise.resolve();
    }
    expect(posts).toBe(2);
    await queue.stop();
  });
});
