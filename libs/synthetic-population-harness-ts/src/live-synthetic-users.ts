/**
 * The Synthetic Users a scenario has, carrying on as deployed ones do: each
 * on its own device, its application ticking at the worker's pace, renewing
 * its Worker Lease through the worker control plane (which tells it whom to
 * play and when its day is over) and reporting what it is doing.
 */
import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import {
  type PlayingPersona,
  type PlayMemory,
  SyntheticUserApplication,
} from '@libs/synthetic-population-behavior-shared-ts/synthetic-user-application';
import type { ApplicationEvent } from '@libs/synthetic-population-shared-ts/application-events';
import { reconcileCheckpoint } from '@libs/synthetic-population-shared-ts/config';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { fixtureWorkerRpc } from './fixture-worker-rpc';

/** How often a deployed worker renews each lease. */
const RENEW_MS = 5_000;

export type LiveSyntheticUser = {
  readonly name: string;
  readonly actor: string;
  readonly userId: string;
  readonly accountId: string;
};
/** What a scenario decided about a Synthetic User before it plays. */
export type PlaySetup = {
  readonly persona?: Partial<PlayingPersona>;
  readonly memory?: PlayMemory;
  readonly random?: () => number;
};
type Renewal = {
  readonly paused: boolean;
  readonly draining: boolean;
  readonly config: {
    readonly sessionMs: number;
    readonly actionIntervalMs: number;
  };
  readonly waitingOpponents: readonly { gameId: string; timeControl: string }[];
  readonly reservedGames: readonly string[];
};
type Running = {
  readonly member: LiveSyntheticUser;
  readonly app: SyntheticUserApplication;
  renewal: Renewal | null;
  renewedAt: number;
  nextTickAt: number;
  closed: boolean;
  /** It saw its game reach a result while it was still online now. */
  readonly finishedOnline: boolean;
  /** Its game is still ongoing (if it went offline, it left mid-game). */
  readonly leftMidGame: boolean;
};
type Population = {
  readonly setups: Map<string, PlaySetup>;
  readonly running: Map<string, Running>;
};
const populations = new WeakMap<ProductHarness, Population>();

function population(s: ProductHarness): Population {
  const known = populations.get(s);
  if (known !== undefined) return known;
  const fresh: Population = { setups: new Map(), running: new Map() };
  populations.set(s, fresh);
  return fresh;
}

/** Decide something about how the named Synthetic User plays, before it does. */
export function setPlaySetup(
  s: ProductHarness,
  name: string,
  setup: PlaySetup
): void {
  const setups = population(s).setups;
  const actor = name.toLowerCase();
  const known = setups.get(actor) ?? {};
  setups.set(actor, {
    ...known,
    ...setup,
    persona: { ...known.persona, ...setup.persona },
    memory: { ...known.memory, ...setup.memory },
  });
  population(s).running.delete(actor);
}

/** The Synthetic Users signed in on the scenario's devices. */
export async function liveSyntheticUsers(
  s: ProductHarness
): Promise<LiveSyntheticUser[]> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
      username: string;
      account_id: string;
    }>`SELECT id, username, account_id FROM population_users WHERE account_id IS NOT NULL AND deleted_at IS NULL ORDER BY username`
  );
  const members: LiveSyntheticUser[] = [];
  for (const row of rows) {
    const actor = row.username.toLowerCase();
    if (!s.actors.has(actor)) continue;
    if ((await signedInAccountOf(s, actor)) !== row.account_id) continue;
    members.push({
      name: row.username,
      actor,
      userId: row.id,
      accountId: row.account_id,
    });
  }
  return members;
}

async function personaOf(
  s: ProductHarness,
  member: Pick<LiveSyntheticUser, 'userId'>
) {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      personality: unknown;
    }>`SELECT personality FROM population_users WHERE id = ${member.userId}`
  );
  const raw = rows[0]?.personality;
  return parsePersona(typeof raw === 'string' ? JSON.parse(raw) : raw);
}

/**
 * The Synthetic User's application on its device, playing as its persona
 * and as the scenario decided before it plays.
 */
export async function syntheticApplication(
  s: ProductHarness,
  member: Pick<LiveSyntheticUser, 'actor' | 'userId'>,
  emit: (event: ApplicationEvent) => void = () => undefined
): Promise<SyntheticUserApplication> {
  const setup = population(s).setups.get(member.actor) ?? {};
  const stored = await personaOf(s, member);
  const app = new SyntheticUserApplication(await actorUi(s, member.actor), {
    games: GAME_AUTOMATIONS,
    clock: s.harness.clock,
    random: setup.random ?? s.session.ports.random,
    username: member.actor,
    ...(stored === null && setup.persona === undefined
      ? {}
      : {
          persona: {
            thinkingTime: { minMs: 2_000, maxMs: 8_000 },
            skillLevel: 'intermediate',
            rematchWeight: 0.35,
            hostingWeight: 0.3,
            favoriteGames: [],
            ...stored,
            ...setup.persona,
          },
        }),
    ...(setup.memory === undefined ? {} : { memory: setup.memory }),
    emit,
  });
  app.authenticated();
  return app;
}

async function running(
  s: ProductHarness,
  member: LiveSyntheticUser
): Promise<Running> {
  const known = population(s).running.get(member.actor);
  if (known !== undefined && !known.closed) return known;
  const games = { ongoing: false, finished: false };
  const app = await syntheticApplication(s, member, (event) => {
    // Its game, as it sees it: a result reached while it is still online.
    if (event.name === 'GameStarted' || event.action === 'MATCH')
      games.ongoing = true;
    if (event.name === 'GameCompleted' && games.ongoing) {
      games.ongoing = false;
      games.finished = true;
    }
  });
  const fresh: Running = {
    member,
    app,
    renewal: null,
    renewedAt: Number.NEGATIVE_INFINITY,
    nextTickAt: s.harness.clock.now(),
    closed: false,
    get finishedOnline() {
      return games.finished;
    },
    get leftMidGame() {
      return games.ongoing;
    },
  };
  population(s).running.set(member.actor, fresh);
  return fresh;
}

async function lease(s: ProductHarness, member: LiveSyntheticUser) {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      worker_id: string | null;
      generation: number;
    }>`SELECT worker_id, generation FROM population_users WHERE id = ${member.userId}`
  );
  const row = rows[0];
  if (row === undefined || row.worker_id === null) return null;
  return {
    userId: member.userId,
    workerId: row.worker_id,
    generation: Number(row.generation),
  };
}

/** Renew the Worker Lease as its worker does; `null` once the lease is lost. */
async function renew(s: ProductHarness, run: Running): Promise<void> {
  const owned = await lease(s, run.member);
  if (owned === null || (await renewed(s, owned, run)) === false)
    run.closed = true;
}

async function renewed(
  s: ProductHarness,
  owned: NonNullable<Awaited<ReturnType<typeof lease>>>,
  run: Running
): Promise<boolean> {
  const rpc = await fixtureWorkerRpc(s);
  const response = await rpc.renew.$post({ json: owned });
  if (response.status !== 200) return false;
  run.renewal = (await response.json()).renewal;
  run.renewedAt = s.harness.clock.now();
  return true;
}

/** Report what the Synthetic User is doing, as its worker checkpoints it. */
async function checkpoint(s: ProductHarness, run: Running): Promise<void> {
  const owned = await lease(s, run.member);
  if (owned === null) return;
  const rpc = await fixtureWorkerRpc(s);
  await rpc.checkpoint.$post({
    json: {
      ...owned,
      checkpoint: {
        ...reconcileCheckpoint(null, s.harness.clock.now(), run.member.userId),
        activity: run.app.activity(),
      },
      version: 'spec',
      action: null,
      error: null,
    },
  });
}

/** One worker tick: its whole next activity, as the deployed worker runs it. */
async function tick(s: ProductHarness, run: Running): Promise<void> {
  const now = s.harness.clock.now();
  if (now - run.renewedAt >= RENEW_MS) await renew(s, run);
  if (run.closed || run.renewal === null) return;
  const wake = run.app.nextWakeAt();
  if (now < run.nextTickAt && (wake === null || now < wake)) {
    if (run.app.continuousIntervalMs() !== null) {
      await bringToFront(s, run.member.actor);
      await run.app.continueCurrentGame();
    }
    return;
  }
  await bringToFront(s, run.member.actor);
  const active = await run.app.tick({
    paused: run.renewal.paused,
    draining: run.renewal.draining,
    elapsedMs: 0,
    sessionMs: run.renewal.config.sessionMs,
    waitingOpponents: run.renewal.waitingOpponents,
    reservedGames: run.renewal.reservedGames,
  });
  run.nextTickAt = s.harness.clock.now() + run.renewal.config.actionIntervalMs;
  await checkpoint(s, run);
  if (active) return;
  // The application logged out: its worker releases the lease.
  const owned = await lease(s, run.member);
  if (owned !== null)
    await (await fixtureWorkerRpc(s)).release.$post({ json: owned });
  run.app.close();
  run.closed = true;
}

/**
 * Every Synthetic User the scenario has carries on, as deployed ones do,
 * for up to `maxMs`; sooner once `settled` says what the scenario waits
 * for has happened. `observe` runs after every step of time, to record
 * what people see as it happens.
 */
export async function carryOnSyntheticUsers(
  s: ProductHarness,
  options: {
    readonly maxMs: number;
    readonly settled?: () => Promise<boolean>;
    readonly observe?: () => Promise<void>;
    readonly only?: (member: LiveSyntheticUser) => boolean;
  }
): Promise<void> {
  const end = s.harness.clock.now() + options.maxMs;
  const members = (await liveSyntheticUsers(s)).filter(
    (member) => options.only?.(member) ?? true
  );
  while (s.harness.clock.now() < end) {
    let continuous = false;
    for (const member of members) {
      const run = await running(s, member);
      if (run.closed) continue;
      await tick(s, run);
      continuous ||= run.app.continuousIntervalMs() !== null;
    }
    await options.observe?.();
    if ((await options.settled?.()) === true) return;
    await s.session.advanceTime(continuous ? 100 : 250);
    await s.session.waitForIdle();
  }
}

/** Whether the named Synthetic User stayed online now until its game had its result. */
export function stayedOnlineToFinish(s: ProductHarness, name: string): boolean {
  const run = population(s).running.get(name.toLowerCase());
  return run !== undefined && run.finishedOnline && !run.leftMidGame;
}

/** Whether the named Synthetic User's application has closed and its lease is released. */
export function syntheticUserClosed(s: ProductHarness, name: string): boolean {
  return population(s).running.get(name.toLowerCase())?.closed === true;
}

/** How long Synthetic Users above the desired population get to finish and leave. */
const SETTLE_MS = 5 * 60_000;

async function onlineCount(s: ProductHarness): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${new Date(s.harness.clock.now()).toISOString()} AND deleted_at IS NULL`
  );
  return rows.length;
}

/**
 * After the desired synthetic population is lowered, the scenario's
 * Synthetic Users carry on as deployed ones do while more are online now
 * than desired: those above it finish what they are doing and leave.
 */
export async function settleAboveDesired(
  s: ProductHarness,
  desired: number
): Promise<void> {
  if ((await liveSyntheticUsers(s)).length === 0) return;
  if ((await onlineCount(s)) <= desired) return;
  await carryOnSyntheticUsers(s, {
    maxMs: SETTLE_MS,
    settled: async () => (await onlineCount(s)) <= desired,
  });
}
