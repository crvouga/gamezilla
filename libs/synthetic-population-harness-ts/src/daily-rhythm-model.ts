/**
 * The daily-rhythm model's Synthetic Users — Cedar, Maple and Birch — held
 * online by the deployed worker, their days beginning and ending.
 */
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  localHourAt,
  onSchedule,
} from '@libs/synthetic-population-shared-ts/daily-schedule';
import {
  type Persona,
  parsePersona,
} from '@libs/synthetic-population-shared-ts/persona';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  desiredSyntheticPopulation,
  givenDesiredSyntheticPopulation,
} from './observatory-actions';
import {
  deployedWorkerHeartbeat,
  heldPlaying,
  runDeployedWorker,
  setHeldPlaying,
} from './population-worker';

export const RHYTHM_USERS = ['Cedar', 'Maple', 'Birch'] as const;

type Row = { id: string; username: string; personality: unknown };

async function rows(s: ProductHarness): Promise<Row[]> {
  return s.harness.serverSql.sqlClient.query(
    sql<Row>`SELECT id, username, personality FROM population_users WHERE deleted_at IS NULL ORDER BY created_at, id`
  );
}
function personaOf(row: Row): Persona {
  const raw = row.personality;
  const persona = parsePersona(typeof raw === 'string' ? JSON.parse(raw) : raw);
  if (persona === null) throw new Error(`${row.username} has no persona`);
  return persona;
}
async function rowNamed(s: ProductHarness, name: string): Promise<Row> {
  const row = (await rows(s)).find((candidate) => candidate.username === name);
  if (row === undefined) throw new Error(`No Synthetic User is called ${name}`);
  return row;
}

/** Its day, as its persona says: on (`now` within it) or over. */
async function setDay(s: ProductHarness, name: string, on: boolean) {
  const row = await rowNamed(s, name);
  const persona = personaOf(row);
  const zone = persona.dailySchedule.timeZone;
  const hour = Math.floor(localHourAt(zone, s.harness.clock.now()));
  const dailySchedule = on
    ? { timeZone: zone, startHour: hour, endHour: (hour + 4) % 24 }
    : { timeZone: zone, startHour: (hour + 1) % 24, endHour: hour };
  await s.harness.serverSql.sqlClient.run(
    sql`UPDATE population_users SET personality = ${JSON.stringify({ ...persona, dailySchedule })} WHERE id = ${row.id}`
  );
}

/** Cedar, Maple and Birch, none of them on their daily schedule, with the desired population. */
export const givenDailyRhythm = scenarioAction({
  name: 'givenDailyRhythm',
  act: async (s, desired: number) => {
    await Promise.resolve(
      givenDesiredSyntheticPopulation.act(s, RHYTHM_USERS.length)
    );
    await deployedWorkerHeartbeat(s);
    const db = s.harness.serverSql.sqlClient;
    const provisioned = await rows(s);
    for (const [index, name] of RHYTHM_USERS.entries()) {
      const row = provisioned[index];
      if (row === undefined)
        throw new Error('The population was not provisioned');
      await db.run(
        sql`UPDATE population_users SET username = ${name} WHERE id = ${row.id}`
      );
      await setDay(s, name, false);
    }
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, desired));
    runDeployedWorker(s, true);
  },
});

/** Rather than live through hours, the Synthetic User's daily schedule begins now. */
export const dayBegins = scenarioAction({
  name: 'dayBegins',
  act: (s, name: string) => setDay(s, name, true),
});

/** Rather than live through hours, the Synthetic User's daily schedule is over now. */
export const dayEnds = scenarioAction({
  name: 'dayEnds',
  act: (s, name: string) => setDay(s, name, false),
});

/** The held Synthetic User starts a game, or its game reaches its result. */
export const playsGame = scenarioAction({
  name: 'playsGame',
  act: async (s, name: string, playing: boolean) => {
    await setHeldPlaying(s, (await rowNamed(s, name)).id, playing);
  },
});

/** What the daily-rhythm model names: whose day it is, who is online now and who plays. */
export async function observeDailyRhythm(s: ProductHarness) {
  const now = s.harness.clock.now();
  const leased = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${new Date(now).toISOString()} AND deleted_at IS NULL`
  );
  const online = new Set(leased.map((row) => row.id));
  const named = (await rows(s)).filter((row) =>
    (RHYTHM_USERS as readonly string[]).includes(row.username)
  );
  return {
    onSchedule: new Set(
      named
        .filter((row) => onSchedule(personaOf(row).dailySchedule, now))
        .map((row) => row.username)
    ),
    onlineNow: new Set(
      named.filter((row) => online.has(row.id)).map((row) => row.username)
    ),
    playing: new Set(
      named
        .filter((row) => online.has(row.id) && heldPlaying(s, row.id))
        .map((row) => row.username)
    ),
    desiredPopulation: await desiredSyntheticPopulation(s),
  };
}
