import { describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  MutationUploadQueue,
  type MutationUploadRow,
} from '../../client/mutation-upload-queue';
import { createTableChangeBus } from '../../queries/client/table-change-bus';

const timers: Timers = {
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

const pendingRow = {
  id: 'm1',
  name: 'setNote',
  args: '{}',
  client_id: 'c0',
  seq: 1,
  created_at: '2020-01-01T00:00:00.000Z',
};

function stubDb(): SqlClient {
  const pending = [{ ...pendingRow }];
  return {
    query: async () => pending,
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn({
        query: async () => pending,
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      } as unknown as SqlClient),
    connect: async () => undefined,
    disconnect: async () => undefined,
  } as unknown as SqlClient;
}

describe('mutation upload verdict pairing', () => {
  test('does not delete queue rows when verdict count mismatches', async () => {
    let postCalls = 0;
    let resolvePosted: () => void = () => undefined;
    const posted = new Promise<void>((resolve) => {
      resolvePosted = resolve;
    });
    const queue = new MutationUploadQueue({
      db: stubDb(),
      bus: createTableChangeBus(),
      clientId: () => 'c0',
      postBatch: async (_rows: readonly MutationUploadRow[]) => {
        postCalls += 1;
        resolvePosted();
        return { ok: true, verdicts: [], ackSeq: 1 };
      },
      onError: () => undefined,
      timers,
      now: () => 0,
    });
    queue.start();
    queue.wake();
    await posted;
    await queue.stop();
    expect(postCalls).toBe(1);
  });
});
