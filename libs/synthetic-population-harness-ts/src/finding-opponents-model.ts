/**
 * The finding-opponents model's world: people looking for a chess opponent,
 * and Synthetic Users that, apart from the activity a step starts, only
 * ever answer the people waiting for them.
 */

import { sendMoveFromBoard } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
} from './game-choice-actions';
import {
  carryOnSyntheticUsers,
  setPlaySetup,
  setScenarioCarryOn,
} from './live-synthetic-users';
import { lookForMultiplayerOpponent } from './opponent-finding-actions';

export const GAME = 'chess';
const SYNTHETIC = ['Cedar', 'Maple', 'Birch'] as const;
const PEOPLE = ['bob', 'carol', 'dave', 'erin', 'frank', 'grace'] as const;
/** Long enough for a Synthetic User sent to a person to have answered. */
const ANSWER_MS = 45_000;

type World = { synthetic: string[]; people: string[] };
const worlds = new WeakMap<ProductHarness, World>();
function worldOf(s: ProductHarness): World {
  const known = worlds.get(s);
  if (known === undefined) throw new Error('The model world was not given');
  return known;
}

async function pausedNames(s: ProductHarness): Promise<Set<string>> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      username: string;
    }>`SELECT username FROM population_users WHERE paused = ${true} AND deleted_at IS NULL`
  );
  return new Set(rows.map((row) => row.username));
}

/** What an actor's own device shows: looking, playing, or neither. */
async function standing(s: ProductHarness, actor: string) {
  const view = await multiplayerView(s, actor);
  if (view.game !== null && view.game.outcome === 'ongoing') return 'playing';
  if (view.search?.standing === 'waiting') return 'looking';
  return 'idle';
}

/** A first move each side can always make: White's, and Black's answer to any. */
const FIRST_MOVES = ['e2e4', 'g8f6'] as const;

function offline(s: ProductHarness, person: string): boolean {
  return s.session.network
    .partitions()
    .some((pair) => (pair as readonly string[]).includes(person));
}

/**
 * People play the games they are matched into: each makes their first move
 * when it is theirs, so no game is called off for a first move nobody made.
 */
async function peopleMakeTheirFirstMove(s: ProductHarness): Promise<void> {
  for (const person of worldOf(s).people) {
    if (offline(s, person)) continue;
    const own = await signedInAccountOf(s, person);
    const game = (await multiplayerView(s, person)).game;
    if (own === null || game === null || game.outcome !== 'ongoing') continue;
    const uci = FIRST_MOVES[game.revision];
    if (game.turn !== own || uci === undefined) continue;
    await sendMoveFromBoard(s, person, {
      gameId: game.id,
      revision: game.revision,
      uci,
      requestId: `first-move-${game.id}-${person}`,
    });
  }
}

/** `available` Synthetic Users, each signed in and answering only people who wait for it. */
export const givenFindingOpponents = scenarioAction({
  name: 'givenFindingOpponents',
  act: async (s, available: number) => {
    const synthetic = SYNTHETIC.slice(0, available);
    worlds.set(s, { synthetic: [...synthetic], people: [] });
    // A paused Synthetic User rests until it is resumed; people play on.
    setScenarioCarryOn(s, {
      people: () => peopleMakeTheirFirstMove(s),
      resting: () => pausedNames(s),
    });
    for (const name of synthetic) {
      await Promise.resolve(givenSyntheticGameChoice.act(s, name));
      // It browses unless sent to a person; it never offers a rematch.
      setPlaySetup(s, name, {
        persona: { hostingWeight: 0, rematchWeight: 0 },
        random: () => 0.95,
      });
    }
  },
});

/** The Synthetic Users carry on: everyone not paused. */
async function carryOn(s: ProductHarness, settled: () => Promise<boolean>) {
  await carryOnSyntheticUsers(s, { maxMs: ANSWER_MS, settled });
}

/** A new person looks for a chess opponent; the Synthetic Users carry on meanwhile. */
export const personLooks = scenarioAction({
  name: 'personLooks',
  act: async (s) => {
    const world = worldOf(s);
    const person = PEOPLE[world.people.length];
    if (person === undefined) throw new Error('The model ran out of people');
    world.people.push(person);
    await Promise.resolve(lookForMultiplayerOpponent.act(s, person, GAME));
  },
});

/** The first available Synthetic User starts looking for a chess opponent. */
export const syntheticUserStarts = scenarioAction({
  name: 'syntheticUserStarts',
  act: async (s) => {
    const paused = await pausedNames(s);
    for (const name of worldOf(s).synthetic) {
      if (paused.has(name)) continue;
      if ((await standing(s, name.toLowerCase())) !== 'idle') continue;
      await Promise.resolve(startSyntheticActivity.act(s, GAME, name));
      return;
    }
    throw new Error('No Synthetic User is available');
  },
});

async function setPaused(s: ProductHarness, name: string, paused: boolean) {
  const db = s.harness.serverSql.sqlClient;
  await db.run(
    sql`UPDATE population_users SET paused = ${paused} WHERE username = ${name}`
  );
  if (s.harness.server.events !== null)
    await notifyChannels({
      pubsub: s.harness.server.events,
      sql: db,
      tables: ['population_users'],
      topics: [],
      now: s.harness.clock.now,
      label: 'synthetic-population-pause-fixture',
    });
}

/** The first available Synthetic User is paused. */
export const pauseAvailable = scenarioAction({
  name: 'pauseAvailable',
  act: async (s) => {
    const paused = await pausedNames(s);
    for (const name of worldOf(s).synthetic) {
      if (paused.has(name)) continue;
      if ((await standing(s, name.toLowerCase())) !== 'idle') continue;
      await setPaused(s, name, true);
      return;
    }
    throw new Error('No Synthetic User is available');
  },
});

async function someoneWaiting(s: ProductHarness) {
  for (const person of worldOf(s).people)
    if ((await standing(s, person)) === 'looking') return true;
  return false;
}
async function nobodyWaiting(s: ProductHarness) {
  return !(await someoneWaiting(s));
}

/** A paused Synthetic User is resumed; it answers a person waiting, if any. */
export const resumePaused = scenarioAction({
  name: 'resumePaused',
  act: async (s) => {
    const paused = await pausedNames(s);
    const name = worldOf(s).synthetic.find((candidate) =>
      paused.has(candidate)
    );
    if (name === undefined) throw new Error('No Synthetic User is paused');
    await setPaused(s, name, false);
    if (await someoneWaiting(s)) await carryOn(s, () => nobodyWaiting(s));
  },
});

/** A person's game against a Synthetic User ends (the person leaves it); it answers a person waiting, if any. */
export const personGameEnds = scenarioAction({
  name: 'personGameEnds',
  act: async (s) => {
    const synthetic = new Set(
      (
        await s.harness.serverSql.sqlClient.query(
          sql<{
            account_id: string;
          }>`SELECT account_id FROM population_users WHERE account_id IS NOT NULL`
        )
      ).map((row) => row.account_id)
    );
    // A person with no connection cannot leave: their game goes on.
    for (const person of worldOf(s).people) {
      if (offline(s, person)) continue;
      const view = await multiplayerView(s, person);
      if (view.game === null || view.game.outcome !== 'ongoing') continue;
      const against = [view.game.white_id, view.game.black_id];
      if (!against.some((id) => id !== null && synthetic.has(id))) continue;
      // Before both have moved a game is aborted, afterwards resigned.
      for (const name of ['abortMultiplayer', 'resignMultiplayer'])
        await Promise.resolve(
          sendMultiplayerCommand.act(s, person, {
            name,
            args: {
              gameId: view.game.id,
              requestId: `${name}-${view.game.id}`,
            },
          })
        );
      if (await someoneWaiting(s)) await carryOn(s, () => nobodyWaiting(s));
      return;
    }
    throw new Error(
      'No person with a connection is playing a Synthetic User: a game ' +
        'cannot end while the person in it has no connection'
    );
  },
});

/** The model's counts, from what each person's and Synthetic User's device shows. */
export async function observeFindingOpponents(s: ProductHarness) {
  const world = worldOf(s);
  const paused = await pausedNames(s);
  const counts = {
    peopleLooking: 0,
    peoplePlaying: 0,
    syntheticAvailable: 0,
    syntheticLooking: 0,
    syntheticPlaying: 0,
    syntheticPaused: 0,
  };
  for (const person of world.people) {
    if ((await signedInAccountOf(s, person)) === null) continue;
    const now = await standing(s, person);
    if (now === 'looking') counts.peopleLooking += 1;
    if (now === 'playing') counts.peoplePlaying += 1;
  }
  for (const name of world.synthetic) {
    const now = await standing(s, name.toLowerCase());
    if (now === 'looking') counts.syntheticLooking += 1;
    else if (now === 'playing') counts.syntheticPlaying += 1;
    else if (paused.has(name)) counts.syntheticPaused += 1;
    else counts.syntheticAvailable += 1;
  }
  return counts;
}
