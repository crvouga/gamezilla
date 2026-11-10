import { expect, test } from 'bun:test';
import { syntheticPopulationForObservatory } from '@libs/synthetic-population-server-ts/observatory-port';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('the User Observatory learns from the directory which accounts are Synthetic Users', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    const bot = f.createId();
    const person = f.createId();
    await f.db.run(
      sql`UPDATE population_users SET account_id = ${bot}, paused = ${true} WHERE id = ${assignment.lease.userId}`
    );
    const port = syntheticPopulationForObservatory(f.ports);
    const found = await port.syntheticUsersOf(f.db, [bot, person]);
    expect([...found.entries()]).toEqual([
      [bot, { id: assignment.lease.userId, paused: true }],
    ]);
    expect((await port.syntheticUsersOf(f.db, [])).size).toBe(0);
  } finally {
    await f.db.disconnect();
  }
});

test('each watch started is kept with the population events for the team', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const watch = {
      actorId: f.createId(),
      sessionId: f.createId(),
      watchedAccountId: f.createId(),
    };
    await syntheticPopulationForObservatory(f.ports).recordWatchStarted(
      f.db,
      watch
    );
    const audits = (await f.repo.events(null)).filter(
      (event) => event.event === 'LiveWatchStarted'
    );
    expect(audits.map((event) => event.context)).toEqual([watch]);
  } finally {
    await f.db.disconnect();
  }
});
