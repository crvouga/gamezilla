import { expect, test } from 'bun:test';
import { renewSyntheticUser } from '@libs/synthetic-population-server-ts/synthetic-user-renewal';
import { localHourAt } from '@libs/synthetic-population-shared-ts/daily-schedule';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

const GAMES = ['some-game', 'another-game'];

async function endDay(
  f: Awaited<ReturnType<typeof syntheticPopulationFixture>>,
  userId: string
) {
  const rows = await f.db.query(
    sql<{
      personality: string;
    }>`SELECT personality FROM population_users WHERE id = ${userId}`
  );
  const persona = parsePersona(rows[0]?.personality ?? null)!;
  const hour = Math.floor(
    localHourAt(persona.dailySchedule.timeZone, f.clock.now())
  );
  const ended = {
    ...persona,
    dailySchedule: {
      ...persona.dailySchedule,
      startHour: (hour + 1) % 24,
      endHour: hour,
    },
  };
  await f.db.run(
    sql`UPDATE population_users SET personality = ${JSON.stringify(ended)} WHERE id = ${userId}`
  );
}

test('a Synthetic User whose day is over drains, and no longer counts towards the desired population', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    await f.controller.heartbeat(
      {
        workerId: f.workers[0]!,
        version: 'v1',
        capacity: 2,
        draining: false,
        memoryBytes: 1000,
        cpuMilliseconds: 0,
        leaseFailures: 0,
      },
      GAMES
    );
    const first = (await f.controller.claim(f.workers[0]!, GAMES))!;
    await f.admin.configure(
      { ...(await f.repo.config()), desired: 1 },
      f.createId()
    );
    expect(await f.controller.claim(f.workers[1]!, GAMES)).toBeNull();
    await endDay(f, first.lease.userId);
    const renewal = await renewSyntheticUser(f.db, f.ports, first.lease);
    expect(renewal?.draining).toBe(true);
    // Finishing its game, it leaves room for another to come online now.
    const second = await f.controller.claim(f.workers[1]!, GAMES);
    expect(second).not.toBeNull();
    expect(second?.lease.userId).not.toBe(first.lease.userId);
    expect(second?.persona.favoriteGames.length).toBeGreaterThan(0);
  } finally {
    await f.db.disconnect();
  }
});

test('a heartbeat that offers games keeps the population as large as desired', async () => {
  const f = await syntheticPopulationFixture(3);
  try {
    await f.controller.heartbeat(
      {
        workerId: f.workers[0]!,
        version: 'v1',
        capacity: 2,
        draining: false,
        memoryBytes: 1000,
        cpuMilliseconds: 0,
        leaseFailures: 0,
      },
      GAMES
    );
    const users = await f.repo.users();
    expect(users).toHaveLength(3);
    expect(new Set(users.map((user) => user.username)).size).toBe(3);
  } finally {
    await f.db.disconnect();
  }
});
