/**
 * Synthetic Users' days: whether each is online now, its daily schedule
 * beginning and ending, and Synthetic Users already online.
 */
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  localHourAt,
  nextScheduleChange,
  onSchedule,
} from '@libs/synthetic-population-shared-ts/daily-schedule';
import {
  type Persona,
  parsePersona,
} from '@libs/synthetic-population-shared-ts/persona';
import { HOME_REGIONS } from '@libs/synthetic-population-shared-ts/persona-regions';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { carryOnSyntheticUsers } from './live-synthetic-users';
import {
  desiredSyntheticPopulation,
  givenDesiredSyntheticPopulation,
} from './observatory-actions';
import {
  claimSyntheticUsers,
  deployedWorkerHeartbeat,
  runDeployedWorker,
} from './population-worker';
import { givenSyntheticUser } from './synthetic-user-fixtures';
import { syntheticPersonaOf } from './synthetic-user-reads';

const HOUR_MS = 60 * 60_000;
/** Long enough after a day ends for whatever it leaves to finish. */
const DAY_END_MS = 5 * 60_000;

type Row = {
  id: string;
  personality: unknown;
  worker_id: string | null;
  lease_until: string | Date | null;
};

async function rowOf(s: ProductHarness, name: string): Promise<Row> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<Row>`SELECT id, personality, worker_id, lease_until FROM population_users WHERE username = ${name} AND deleted_at IS NULL`
  );
  const row = rows[0];
  if (row === undefined) throw new Error(`No Synthetic User is called ${name}`);
  return row;
}

/** Whether the named Synthetic User is online now: a worker holds it in the app. */
export async function syntheticUserOnline(
  s: ProductHarness,
  name: string
): Promise<boolean> {
  const row = await rowOf(s, name);
  return (
    row.worker_id !== null &&
    row.lease_until !== null &&
    new Date(row.lease_until).getTime() > s.harness.clock.now()
  );
}

/** How many Synthetic Users are online now. */
export async function syntheticUsersOnline(s: ProductHarness): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${new Date(s.harness.clock.now()).toISOString()} AND deleted_at IS NULL`
  );
  return rows.length;
}

/**
 * A daily schedule that begins as soon as any home region's next hour
 * does: the soonest day a scenario can wait for.
 */
function soonestSchedule(nowMs: number): Persona['dailySchedule'] {
  let best: { schedule: Persona['dailySchedule']; at: number } | null = null;
  for (const { timeZone } of HOME_REGIONS) {
    const next = (Math.floor(localHourAt(timeZone, nowMs)) + 1) % 24;
    const schedule = { timeZone, startHour: next, endHour: (next + 4) % 24 };
    if (onSchedule(schedule, nowMs)) continue;
    const at = nextScheduleChange(schedule, nowMs);
    if (best === null || at < best.at) best = { schedule, at };
  }
  if (best === null) throw new Error('No home region has a day to begin');
  return best.schedule;
}

async function writePersona(s: ProductHarness, id: string, persona: Persona) {
  await s.harness.serverSql.sqlClient.run(
    sql`UPDATE population_users SET personality = ${JSON.stringify(persona)} WHERE id = ${id}`
  );
}

/**
 * `count` Synthetic Users are online now, none of them playing: the deployed
 * worker holds them, and goes on bringing Synthetic Users online.
 */
export const givenSyntheticUsersOnline = scenarioAction({
  name: 'givenSyntheticUsersOnline',
  act: async (s, count: number) => {
    const was = await desiredSyntheticPopulation(s);
    await Promise.resolve(
      givenDesiredSyntheticPopulation.act(s, Math.max(was, count))
    );
    await deployedWorkerHeartbeat(s);
    await claimSyntheticUsers(s, count);
    // The desired synthetic population the scenario set stays as it was.
    if (was !== Math.max(was, count))
      await Promise.resolve(givenDesiredSyntheticPopulation.act(s, was));
    runDeployedWorker(s, true);
  },
});

const OFFLINE_ROW = sql<Row>`SELECT id, personality, worker_id, lease_until FROM population_users WHERE worker_id IS NULL AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1`;

/** A Synthetic User that is not online now, provisioned if every one is; it is called `name`. */
async function nameOfflineSyntheticUser(
  s: ProductHarness,
  name: string
): Promise<{ id: string; persona: Persona }> {
  const db = s.harness.serverSql.sqlClient;
  let row = (await db.query(OFFLINE_ROW))[0];
  if (row === undefined) {
    // One more Synthetic User than are online, the desired population kept.
    const online = await syntheticUsersOnline(s);
    const desired = await desiredSyntheticPopulation(s);
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, online + 1));
    await deployedWorkerHeartbeat(s);
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, desired));
    row = (await db.query(OFFLINE_ROW))[0];
  }
  if (row === undefined)
    throw new Error('The Synthetic Population has nobody offline');
  await db.run(
    sql`UPDATE population_users SET username = ${name} WHERE id = ${row.id}`
  );
  const raw = row.personality;
  const persona = parsePersona(typeof raw === 'string' ? JSON.parse(raw) : raw);
  if (persona === null) throw new Error(`${name} has no persona`);
  return { id: row.id, persona };
}

/** The named Synthetic User is not online now, and its daily schedule begins at the next hour. */
export const givenNotOnline = scenarioAction({
  name: 'givenNotOnline',
  act: async (s, name: string) => {
    const { id, persona } = await nameOfflineSyntheticUser(s, name);
    await writePersona(s, id, {
      ...persona,
      dailySchedule: soonestSchedule(s.harness.clock.now()),
    });
    runDeployedWorker(s, true);
  },
});

/**
 * The named Synthetic User's daily schedule began this hour, but it is not
 * online now: as many Synthetic Users as the desired synthetic population
 * already are, so it was kept away.
 */
export const givenKeptAway = scenarioAction({
  name: 'givenKeptAway',
  act: async (s, name: string) => {
    const { id, persona } = await nameOfflineSyntheticUser(s, name);
    const zone = persona.dailySchedule.timeZone;
    const hour = Math.floor(localHourAt(zone, s.harness.clock.now()));
    await writePersona(s, id, {
      ...persona,
      dailySchedule: {
        timeZone: zone,
        startHour: hour,
        endHour: (hour + 4) % 24,
      },
    });
    runDeployedWorker(s, true);
  },
});

/** `count` Synthetic Users are online now, none of them playing, and one of them is called `name`. */
export const givenSyntheticUsersOnlineAmong = scenarioAction({
  name: 'givenSyntheticUsersOnlineAmong',
  act: async (s, count: number, name: string) => {
    await Promise.resolve(givenSyntheticUsersOnline.act(s, count));
    const db = s.harness.serverSql.sqlClient;
    const row = (
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${new Date(s.harness.clock.now()).toISOString()} AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1`
      )
    )[0];
    if (row === undefined)
      throw new Error('No Synthetic User is online now to be named');
    await db.run(
      sql`UPDATE population_users SET username = ${name} WHERE id = ${row.id}`
    );
  },
});

/**
 * The Synthetic User played until its daily schedule was over, then closed
 * the app; its schedule begins again at the next hour.
 */
export const givenClosedAfterDay = scenarioAction({
  name: 'givenClosedAfterDay',
  act: async (s, name: string) => {
    await Promise.resolve(givenSyntheticUser.act(s, name, false));
    const row = await rowOf(s, name);
    const persona = await syntheticPersonaOf(s, name);
    if (persona === null) throw new Error(`${name} has no persona`);
    await writePersona(s, row.id, {
      ...persona,
      dailySchedule: soonestSchedule(s.harness.clock.now()),
    });
    await carryOnSyntheticUsers(s, {
      maxMs: DAY_END_MS,
      only: (member) => member.name === name,
      settled: async () => !(await syntheticUserOnline(s, name)),
    });
    runDeployedWorker(s, true);
  },
});

/** Time passes until the named Synthetic User's daily schedule begins. */
export const dailyScheduleBegins = scenarioAction({
  name: 'dailyScheduleBegins',
  act: async (s, name: string) => {
    const persona = await syntheticPersonaOf(s, name);
    if (persona === null) throw new Error(`${name} has no persona`);
    const now = s.harness.clock.now();
    if (onSchedule(persona.dailySchedule, now)) return;
    const at = nextScheduleChange(persona.dailySchedule, now);
    if (at - now > 25 * HOUR_MS) throw new Error(`${name} has no day to begin`);
    await s.session.advanceTime(at - now);
    await s.session.waitForIdle();
  },
});

/**
 * The named Synthetic User's daily schedule is over. Rather than live
 * through hours of its day, its day ends now; it carries on as deployed
 * meanwhile, finishing what it was doing, until it has closed the app.
 */
export const dailyScheduleEnds = scenarioAction({
  name: 'dailyScheduleEnds',
  act: async (s, name: string) => {
    const row = await rowOf(s, name);
    const persona = await syntheticPersonaOf(s, name);
    if (persona === null) throw new Error(`${name} has no persona`);
    const zone = persona.dailySchedule.timeZone;
    const hour = Math.floor(localHourAt(zone, s.harness.clock.now()));
    await writePersona(s, row.id, {
      ...persona,
      dailySchedule: {
        timeZone: zone,
        startHour: (hour + 1) % 24,
        endHour: hour,
      },
    });
    await carryOnSyntheticUsers(s, {
      maxMs: DAY_END_MS,
      only: (member) => member.name === name,
      settled: async () => !(await syntheticUserOnline(s, name)),
    });
  },
});
