import { expect, test } from 'bun:test';
import { SyntheticPopulationController } from '@libs/synthetic-population-server-ts/synthetic-population-controller';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

// regression: worker-claim-serialization-conflict
test('a lost serializable claim rolls back provisioning and returns no assignment', async () => {
  const f = await syntheticPopulationFixture();
  const workerId = '20892fb0-6a2b-48fa-8922-c072143cc056';
  await f.heartbeat(workerId);
  const error = Object.assign(
    new Error('could not serialize access due to concurrent update'),
    { code: '40001' }
  );
  let transactions = 0;
  const db: SqlClient = {
    connect: () => f.db.connect(),
    disconnect: () => f.db.disconnect(),
    query: (query) => f.db.query(query),
    run: (query) => f.db.run(query),
    prepare: (query) => f.db.prepare(query),
    transaction: (run) =>
      f.db.transaction(async (tx) => {
        transactions += 1;
        await run(tx);
        throw error;
      }),
  };
  try {
    const notified = f.notifications();
    const controller = new SyntheticPopulationController(db, f.ports);
    expect(await controller.claim(workerId)).toBeNull();
    expect(transactions).toBe(1);
    expect(await f.repo.users()).toHaveLength(0);
    expect(
      (await f.repo.events(null)).filter(
        (event) => event.event === 'WorkerLeaseAcquired'
      )
    ).toHaveLength(0);
    expect(f.notifications()).toBe(notified);
  } finally {
    await f.db.disconnect();
  }
});

test('a notification failure after commit cannot masquerade as a rolled-back claim', async () => {
  const f = await syntheticPopulationFixture();
  const error = Object.assign(new Error('notification failed'), {
    code: '40001',
  });
  const controller = new SyntheticPopulationController(f.db, {
    ...f.ports,
    notify: async () => {
      throw error;
    },
  });
  try {
    await expect(controller.claim(f.workers[0]!)).rejects.toThrow(
      'notification failed'
    );
    expect(await f.repo.users()).toHaveLength(1);
  } finally {
    await f.db.disconnect();
  }
});
