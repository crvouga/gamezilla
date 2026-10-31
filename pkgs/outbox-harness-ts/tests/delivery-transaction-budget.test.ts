import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { openDueWork, Ping } from './due-work-fixture';

// regression: outbox-drain-holds-whole-pass-transaction
test('each delivery releases its transaction before the next consumer runs', async () => {
  const h = await openDueWork();
  let transaction = 0;
  let insideTransaction = false;
  const notifiedIn: number[] = [];
  const deliveredIn: number[] = [];
  const db: SqlClient = {
    connect: () => h.db.connect(),
    disconnect: () => h.db.disconnect(),
    query: (q) => h.db.query(q),
    run: (q) => h.db.run(q),
    prepare: (q) => h.db.prepare(q),
    transaction: async (fn) => {
      insideTransaction = true;
      transaction += 1;
      try {
        return await h.db.transaction(fn);
      } finally {
        insideTransaction = false;
      }
    },
  };
  try {
    h.registerConsumer({
      id: 'consumer',
      on: Ping,
      handler: async () => {
        deliveredIn.push(transaction);
      },
    });
    for (let i = 0; i < 30; i += 1) await h.append({ id: `event-${i}` });
    expect(
      (
        await drainOutbox({
          ...h.deps,
          db,
          afterDelivery: async () => {
            expect(insideTransaction).toBe(false);
            notifiedIn.push(transaction);
          },
        })
      ).processed
    ).toBe(30);
    expect(new Set(deliveredIn).size).toBe(30);
    expect(notifiedIn).toEqual(deliveredIn);
    expect(
      (
        await drainOutbox({
          ...h.deps,
          db,
          afterDelivery: async () => {
            expect(insideTransaction).toBe(false);
            notifiedIn.push(transaction);
          },
        })
      ).processed
    ).toBe(0);
    expect(deliveredIn).toHaveLength(30);
  } finally {
    await h.db.disconnect();
  }
});

test('a later transaction failure cannot roll back or hide an earlier committed notification', async () => {
  const h = await openDueWork();
  let transactions = 0;
  let notifications = 0;
  const db: SqlClient = {
    connect: () => h.db.connect(),
    disconnect: () => h.db.disconnect(),
    query: (q) => h.db.query(q),
    run: (q) => h.db.run(q),
    prepare: (q) => h.db.prepare(q),
    transaction: async (fn) => {
      transactions += 1;
      if (transactions === 3)
        throw new Error('second delivery lost its connection');
      return h.db.transaction(fn);
    },
  };
  try {
    h.registerConsumer({ id: 'consumer', on: Ping, handler: async () => {} });
    await h.append({ id: 'first' });
    await h.append({ id: 'second' });
    await expect(
      drainOutbox({
        ...h.deps,
        db,
        afterDelivery: async () => {
          notifications += 1;
        },
      })
    ).rejects.toThrow('second delivery lost its connection');
    expect(notifications).toBe(1);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
  } finally {
    await h.db.disconnect();
  }
});

test('outbox telemetry separates candidate creation, selection and committed processing', async () => {
  const h = await openDueWork();
  const phases: string[] = [];
  try {
    h.registerConsumer({ id: 'consumer', on: Ping, handler: async () => {} });
    await h.append({ id: 'measured' });
    await drainOutbox({
      ...h.deps,
      observePhase: async (phase, run) => {
        phases.push(`start:${phase}`);
        try {
          return await run();
        } finally {
          phases.push(`end:${phase}`);
        }
      },
    });
    expect(phases).toEqual([
      'start:outbox-materialize',
      'end:outbox-materialize',
      'start:outbox-claim',
      'end:outbox-claim',
      'start:outbox-commit',
      'end:outbox-commit',
    ]);
  } finally {
    await h.db.disconnect();
  }
});

test('delivery measurements include eligibility and finish after commit, not after the handler alone', async () => {
  const h = await openDueWork();
  const events: string[] = [];
  let eligibleAt = Number.NaN;
  const db: SqlClient = {
    ...h.db,
    connect: () => h.db.connect(),
    disconnect: () => h.db.disconnect(),
    query: (q) => h.db.query(q),
    run: (q) => h.db.run(q),
    prepare: (q) => h.db.prepare(q),
    transaction: async (fn) => {
      const result = await h.db.transaction(fn);
      events.push('transaction-committed');
      return result;
    },
  };
  try {
    h.registerConsumer({
      id: 'consumer',
      on: Ping,
      handler: async () => {
        events.push('handler');
      },
    });
    await h.append({ id: 'eligible' });
    await drainOutbox({
      ...h.deps,
      db,
      measureDelivery: (info) => {
        expect(info.attempt).toBe(1);
        eligibleAt = info.eligibleAtMs;
        events.push('start');
        return (success) => {
          expect(success).toBe(true);
          events.push('committed');
        };
      },
      afterDelivery: async () => {
        events.push('notify');
      },
    });
    expect(Number.isFinite(eligibleAt)).toBe(true);
    expect(events).toEqual([
      'transaction-committed',
      'start',
      'handler',
      'transaction-committed',
      'committed',
      'notify',
    ]);
  } finally {
    await h.db.disconnect();
  }
});
