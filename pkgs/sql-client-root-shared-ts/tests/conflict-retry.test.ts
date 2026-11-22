import { describe, expect, test } from 'bun:test';
import {
  backoffWindowMs,
  CONFLICT_RETRY_ATTEMPTS,
  retryConflictingTransaction,
  retryingConflicts,
  withConflictRetry,
} from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

function serialization(): Error {
  return Object.assign(
    new Error('could not serialize access due to concurrent update'),
    { code: '40001' }
  );
}

/** Work that conflicts `failures` times, then succeeds. */
function conflicting(failures: number) {
  let attempts = 0;
  return {
    work: async (): Promise<string> => {
      attempts += 1;
      if (attempts <= failures) throw serialization();
      return 'saved';
    },
    attempts: () => attempts,
  };
}

const noWait = { wait: async () => {}, random: () => 0 };

describe('withConflictRetry', () => {
  // regression: mutation-hot-topic-seq-conflict-500
  test('writers colliding on one hot row wait a random, growing share before rerunning', async () => {
    const waits: number[] = [];
    const run = conflicting(5);
    const value = await withConflictRetry(run.work, {
      wait: async (ms) => {
        waits.push(ms);
      },
      random: () => 0.999,
    });
    expect(value).toBe('saved');
    expect(run.attempts()).toBe(6);
    expect(waits).toEqual([24, 49, 99, 199, 399]);
  });

  test('the wait window doubles up to its cap', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffWindowMs)).toEqual([
      25, 50, 100, 200, 400, 400, 400,
    ]);
  });

  test('a conflict that never clears still ends after its last attempt', async () => {
    const run = conflicting(Number.POSITIVE_INFINITY);
    await expect(withConflictRetry(run.work, noWait)).rejects.toMatchObject({
      code: '40001',
    });
    expect(run.attempts()).toBe(CONFLICT_RETRY_ATTEMPTS);
  });

  test('anything but a confirmed conflict is thrown at once', async () => {
    let attempts = 0;
    await expect(
      withConflictRetry(async () => {
        attempts += 1;
        throw new Error('connection lost');
      }, noWait)
    ).rejects.toThrow('connection lost');
    expect(attempts).toBe(1);
  });
});

describe('retryConflictingTransaction', () => {
  test('a client that already retries runs the transaction once, not attempts squared', async () => {
    const run = conflicting(Number.POSITIVE_INFINITY);
    const client = retryingConflicts(clientOver(run.work), noWait);
    await expect(
      retryConflictingTransaction(client, async () => 'unused')
    ).rejects.toMatchObject({ code: '40001' });
    expect(run.attempts()).toBe(CONFLICT_RETRY_ATTEMPTS);
  });

  test('a plain client is retried here', async () => {
    const run = conflicting(2);
    expect(
      await retryConflictingTransaction(
        clientOver(run.work),
        async () => 'unused'
      )
    ).toBe('saved');
    expect(run.attempts()).toBe(3);
  });
});

/** A client whose every transaction is `work`, and whose statements conflict. */
function clientOver(
  work: () => Promise<string>,
  onStatement: () => void = () => {}
): SqlClient {
  return {
    connect: async () => {},
    disconnect: async () => {},
    query: async () => {
      onStatement();
      throw serialization();
    },
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    prepare: () => {
      throw new Error('unused');
    },
    transaction: async () => work(),
  } as unknown as SqlClient;
}

describe('retryingConflicts', () => {
  test('reruns a whole transaction, and leaves single statements alone', async () => {
    const run = conflicting(2);
    let statements = 0;
    const inner = clientOver(run.work, () => {
      statements += 1;
    });
    const client = retryingConflicts(inner, noWait);
    expect(await client.transaction(async () => 'unused')).toBe('saved');
    expect(run.attempts()).toBe(3);
    await expect(client.query({} as never)).rejects.toMatchObject({
      code: '40001',
    });
    expect(statements).toBe(1);
  });
});
