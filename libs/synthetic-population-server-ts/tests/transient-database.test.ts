import { expect, test } from 'bun:test';
import { SyntheticPopulationController } from '@libs/synthetic-population-server-ts/synthetic-population-controller';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('a transient database failure rolls back identity provisioning and lease acquisition together', async () => {
  const f = await syntheticPopulationFixture();
  let fail = true;
  const db: SqlClient = {
    connect: () => f.db.connect(),
    disconnect: () => f.db.disconnect(),
    query: (query) => f.db.query(query),
    run: (query) => f.db.run(query),
    prepare: (query) => f.db.prepare(query),
    transaction: (run) =>
      f.db.transaction(async (tx) => {
        const result = await run(tx);
        if (fail)
          throw new Error('Database connection interrupted before commit');
        return result;
      }),
  };
  const controller = new SyntheticPopulationController(db, f.ports);
  try {
    const notified = f.notifications();
    await expect(controller.claim(f.workers[0]!)).rejects.toThrow(
      'before commit'
    );
    expect(await f.repo.users()).toHaveLength(0);
    expect(
      (await f.repo.events(null)).filter(
        (event) => event.event === 'WorkerLeaseAcquired'
      )
    ).toHaveLength(0);
    expect(f.notifications()).toBe(notified);
    fail = false;
    const assignment = await controller.claim(f.workers[1]!);
    expect(assignment?.lease.generation).toBe(1);
    expect(await f.repo.users()).toHaveLength(1);
    expect(await controller.claim(f.workers[0]!)).toBeNull();
  } finally {
    await f.db.disconnect();
  }
});
