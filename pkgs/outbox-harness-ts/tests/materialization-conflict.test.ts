import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { CONFLICT_RETRY_ATTEMPTS } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { openDueWork } from './due-work-fixture';

/** Inject the error at commit so the real SQLite transaction rolls back its inserts. */
function conflictAtCommit(db: SqlClient, failures: number, code: string) {
  let transactions = 0;
  const client: SqlClient = {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (query) => db.query(query),
    run: (query) => db.run(query),
    prepare: (query) => db.prepare(query),
    transaction: (run) =>
      db.transaction(async (tx) => {
        transactions += 1;
        const result = await run(tx);
        if (transactions <= failures)
          throw Object.assign(
            new Error(
              'could not serialize access due to read/write dependencies among transactions'
            ),
            { code }
          );
        return result;
      }),
  };
  return { client, transactions: () => transactions };
}

// regression: outbox-materialization-conflict-aborts-drain
test.each(['40001', '40P01'])(
  'delivery materialization recovers a %s conflict in a fresh transaction',
  async (code) => {
    const h = await openDueWork();
    try {
      h.register(['ping-worker']);
      await h.append({ id: 'scheduled-event' });
      const raced = conflictAtCommit(h.db, 2, code);
      const result = await drainOutbox({ ...h.deps, db: raced.client });
      expect(result.processed).toBe(1);
      expect(raced.transactions()).toBe(4);
      expect(h.attempts).toEqual(['scheduled-event:ping-worker']);
      expect(h.seen).toEqual(['ping-worker:7']);
      const rows = await h.deliveryState();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.attempts).toBe(0);
      expect(rows[0]?.processed_at).not.toBeNull();
    } finally {
      await h.db.disconnect();
    }
  }
);

test.each([
  ['40001', CONFLICT_RETRY_ATTEMPTS],
  ['XX000', 1],
] as const)(
  'a persistent %s failure stays visible after %i transactions and keeps work pending',
  async (code, expected) => {
    const h = await openDueWork();
    try {
      h.register(['ping-worker']);
      await h.append({ id: 'scheduled-event' });
      const raced = conflictAtCommit(h.db, 100, code);
      await expect(
        drainOutbox({ ...h.deps, db: raced.client })
      ).rejects.toThrow('read/write dependencies');
      expect(raced.transactions()).toBe(expected);
      expect(h.attempts).toEqual([]);
      expect(await h.deliveryState()).toEqual([]);
      expect((await drainOutbox(h.deps)).processed).toBe(1);
      expect(h.seen).toEqual(['ping-worker:7']);
    } finally {
      await h.db.disconnect();
    }
  }
);
