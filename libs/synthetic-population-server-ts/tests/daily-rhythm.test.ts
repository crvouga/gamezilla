import { expect, test } from 'bun:test';
import { renewSyntheticUser } from '@libs/synthetic-population-server-ts/synthetic-user-renewal';
import { localHourAt } from '@libs/synthetic-population-shared-ts/daily-schedule';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

const GAMES = ['some-game', 'another-game'];

type Fixture = Awaited<ReturnType<typeof syntheticPopulationFixture>>;

async function endDay(f: Fixture, userId: string) {
  await setDay(f, userId, false);
}

/** The user's daily schedule has it online now (`on`), or is over. */
async function setDay(f: Fixture, userId: string, on: boolean) {
  const rows = await f.db.query(
    sql<{
      personality: string;
    }>`SELECT personality FROM population_users WHERE id = ${userId}`
  );
  const persona = parsePersona(rows[0]?.personality ?? null)!;
  const hour = Math.floor(
    localHourAt(persona.dailySchedule.timeZone, f.clock.now())
  );
  const dailySchedule = on
    ? { ...persona.dailySchedule, startHour: hour, endHour: (hour + 4) % 24 }
    : { ...persona.dailySchedule, startHour: (hour + 1) % 24, endHour: hour };
  await f.db.run(
    sql`UPDATE population_users SET personality = ${JSON.stringify({ ...persona, dailySchedule })} WHERE id = ${userId}`
  );
}

async function idsByAge(f: Fixture): Promise<string[]> {
  const rows = await f.db.query(
    sql<{ id: string }>`SELECT id FROM population_users ORDER BY created_at, id`
  );
  return rows.map((row) => row.id);
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

test('a place that frees up goes to the Synthetic User kept away longest, not the oldest', async () => {
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
    await f.admin.configure(
      { ...(await f.repo.config()), desired: 1 },
      f.createId()
    );
    const [oldest, middle, newest] = await idsByAge(f);
    await setDay(f, oldest!, true);
    await setDay(f, middle!, false);
    await setDay(f, newest!, false);
    const online = (await f.controller.claim(f.workers[0]!, GAMES))!;
    expect(online.lease.userId).toBe(oldest!);
    // The newest is kept away first, the middle one a second later.
    await setDay(f, newest!, true);
    expect(await f.controller.claim(f.workers[1]!, GAMES)).toBeNull();
    f.clock.set(f.clock.now() + 1000);
    await setDay(f, middle!, true);
    expect(await f.controller.claim(f.workers[1]!, GAMES)).toBeNull();
    await endDay(f, oldest!);
    const next = await f.controller.claim(f.workers[1]!, GAMES);
    expect(next?.lease.userId).toBe(newest!);
  } finally {
    await f.db.disconnect();
  }
});

test('a Synthetic User whose device cannot connect is passed over, keeping its place in line', async () => {
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
    await f.admin.configure(
      { ...(await f.repo.config()), desired: 1 },
      f.createId()
    );
    const [oldest, middle, newest] = await idsByAge(f);
    for (const id of [oldest!, middle!, newest!]) await setDay(f, id, true);
    expect((await f.controller.claim(f.workers[0]!, GAMES))?.lease.userId).toBe(
      oldest!
    );
    await endDay(f, oldest!);
    const next = await f.controller.claim(f.workers[1]!, GAMES, [middle!]);
    expect(next?.lease.userId).toBe(newest!);
  } finally {
    await f.db.disconnect();
  }
});
