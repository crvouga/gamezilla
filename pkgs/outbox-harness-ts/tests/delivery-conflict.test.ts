import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { NOW, openDueWork } from './due-work-fixture';

const conflict = () =>
  Object.assign(
    new Error(
      'could not serialize access due to read/write dependencies among transactions'
    ),
    { code: '40001' }
  );

function failingDelivery(
  db: SqlClient,
  options: {
    at: 'lock' | 'commit';
    recoveryFails?: boolean;
    concurrentCompletion?: boolean;
  }
) {
  let transactions = 0;
  const client: SqlClient = {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (query) => db.query(query),
    run: (query) => db.run(query),
    prepare: (query) => db.prepare(query),
    transaction: async (run) => {
      const current = ++transactions;
      try {
        return await db.transaction(async (tx) => {
          if (options.recoveryFails && current >= 3) throw conflict();
          if (current === 2 && options.at === 'lock') throw conflict();
          const result = await run(tx);
          if (current === 2) throw conflict();
          return result;
        });
      } catch (error) {
        if (current === 2 && options.concurrentCompletion)
          await db.run(
            sql`UPDATE outbox_deliveries SET processed_at = ${new Date(NOW).toISOString()} WHERE event_id = ${'first'}`
          );
        throw error;
      }
    },
  };
  return { client, transactions: () => transactions };
}

// regression: outbox-conflict-retry-uses-doomed-snapshot
test.each(['lock', 'commit'] as const)(
  'a %s conflict reschedules only the losing delivery and continues the pass',
  async (at) => {
    const h = await openDueWork();
    try {
      h.register(['ping-worker']);
      await h.append({ id: 'first', at: -1 });
      await h.append({ id: 'second' });
      const raced = failingDelivery(h.db, { at });
      expect(
        (await drainOutbox({ ...h.deps, db: raced.client })).processed
      ).toBe(1);
      const rows = await h.deliveryState();
      expect(rows.map((row) => row.attempts)).toEqual([0, 0]);
      expect(rows[0]?.processed_at).toBeNull();
      expect(rows[1]?.processed_at).not.toBeNull();
      expect((await drainOutbox(h.deps)).processed).toBe(0);
      h.advance(1_000);
      expect((await drainOutbox(h.deps)).processed).toBe(1);
    } finally {
      await h.db.disconnect();
    }
  }
);

test('conflict recovery never overwrites a delivery another worker completed', async () => {
  const h = await openDueWork();
  try {
    h.register(['ping-worker']);
    await h.append({ id: 'first' });
    const raced = failingDelivery(h.db, {
      at: 'lock',
      concurrentCompletion: true,
    });
    expect((await drainOutbox({ ...h.deps, db: raced.client })).processed).toBe(
      0
    );
    const rows = await h.deliveryState();
    expect(rows[0]?.processed_at).not.toBeNull();
    expect(rows[0]?.last_error).toBeNull();
    expect((await drainOutbox(h.deps)).processed).toBe(0);
  } finally {
    await h.db.disconnect();
  }
});

test('a failed recovery transaction remains a visible drain failure with its event retained', async () => {
  const h = await openDueWork();
  try {
    h.register(['ping-worker']);
    await h.append({ id: 'first' });
    const raced = failingDelivery(h.db, { at: 'commit', recoveryFails: true });
    await expect(drainOutbox({ ...h.deps, db: raced.client })).rejects.toThrow(
      'read/write dependencies'
    );
    expect(raced.transactions()).toBe(5);
    const rows = await h.deliveryState();
    expect(rows[0]?.processed_at).toBeNull();
    expect(rows[0]?.attempts).toBe(0);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
  } finally {
    await h.db.disconnect();
  }
});
