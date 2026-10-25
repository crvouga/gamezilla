import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { partitioned } from '@libs/harness-ts/observations';
import { restoreLightCyclesArena } from './light-cycles-arena-fixture';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesRiderName,
  lightCyclesBoardShown,
} from './light-cycles-board-view';
import {
  establishLightCyclesGame,
  lightCyclesLineup,
  lightCyclesObserver,
  personOf,
  ridingPeople,
  startedLightCycles,
} from './light-cycles-lineup';
import { customGameStatusShown } from './light-cycles-reads';
import { crashRiders } from './light-cycles-riding-actions';
import { arrangeRoundWins } from './light-cycles-round-actions';

export type LightCyclesStage = 'under way' | 'finished' | 'called off';

/** Everyone away for 30 seconds calls a shared game off; a little more lets it land. */
const CALLED_OFF_MS = 31_000;
const SETTLED_MS = 5000;

/** The game the scenario named, or Alice and Bob's Duel when it named none. */
async function theGame(s: ProductHarness): Promise<void> {
  try {
    lightCyclesLineup(s);
  } catch {
    await Promise.resolve(
      establishLightCyclesGame.act(s, {
        count: 2,
        riders: { Comet: 'alice', Ember: 'bob' },
      })
    );
  }
  await startedLightCycles(s);
}

/** A person loses their device's connection, as the shared steps cut it. */
export async function loseConnection(s: ProductHarness, person: string) {
  await Promise.resolve(partition.act(s, person));
  await Promise.resolve(refreshActorConnection.act(s, person));
  await Promise.resolve(refreshActorQueries.act(s, person));
}

/** A person's connection comes back. */
export async function connectionBack(s: ProductHarness, person: string) {
  if (!partitioned(s).some((pair) => pair.split('|').includes(person))) return;
  await Promise.resolve(restoreActorConnection.act(s, person));
  await Promise.resolve(refreshActorQueries.act(s, person));
}

/**
 * `winner` wins the game with every other rider on `othersWins` round wins:
 * every other rider crashes in a round that gives `winner` its last one. Riders a person rides crash by their person's
 * steering; with any other rider left, the round is given its last step
 * instead: everyone else already crashed.
 */
export const winLightCycles = scenarioAction({
  name: 'winLightCycles',
  act: async (s, winner: LightCyclesRiderName, othersWins: number = 0) => {
    await theGame(s);
    const { count, target } = lightCyclesLineup(s);
    const riders = LIGHT_CYCLES_RIDER_NAMES.slice(0, count);
    const losers = riders.filter((rider) => rider !== winner);
    await Promise.resolve(
      arrangeRoundWins.act(s, {
        ...Object.fromEntries(losers.map((rider) => [rider, othersWins])),
        [winner]: target - 1,
      })
    );
    if (losers.every((rider) => personOf(s, rider) !== null))
      await Promise.resolve(crashRiders.act(s, losers));
    else
      await restoreLightCyclesArena(s, (saved) => ({
        ...saved,
        phase: 'running',
        phaseTick: 2,
        riders: saved.riders.map((rider, index) =>
          LIGHT_CYCLES_RIDER_NAMES[index] === winner
            ? rider
            : { ...rider, alive: false }
        ),
        crashes: saved.riders.flatMap((rider, index) =>
          LIGHT_CYCLES_RIDER_NAMES[index] === winner
            ? []
            : [{ seat: rider.seat, x: rider.x, y: rider.y, cause: 'retired' }]
        ),
      }));
    await pollUntil(
      s,
      async () =>
        (await lightCyclesBoardShown(s, lightCyclesObserver(s))).phase ===
        'completed'
          ? true
          : null,
      { maxMs: SETTLED_MS, stepMs: 10, description: 'the finished game' }
    );
  },
});

/**
 * Every person riding loses their connection and stays away until the game
 * is called off; then their connections come back.
 */
export const callOffLightCycles = scenarioAction({
  name: 'callOffLightCycles',
  act: async (s) => {
    await theGame(s);
    const people = ridingPeople(s);
    for (const person of people) await loseConnection(s, person);
    await s.session.advanceTime(CALLED_OFF_MS);
    for (const person of people) await connectionBack(s, person);
    await pollUntil(
      s,
      async () =>
        (await customGameStatusShown(s, lightCyclesObserver(s))) === 'cancelled'
          ? true
          : null,
      { maxMs: SETTLED_MS, stepMs: 50, description: 'the called-off game' }
    );
  },
});

/** The game reaches `stage`: under way, finished (Comet wins) or called off. */
export const reachLightCyclesStage = scenarioAction({
  name: 'reachLightCyclesStage',
  act: async (s, stage: LightCyclesStage) => {
    await theGame(s);
    if (stage === 'finished')
      await Promise.resolve(winLightCycles.act(s, 'Comet'));
    if (stage === 'called off')
      await Promise.resolve(callOffLightCycles.act(s));
  },
});

/** Where the game stands as `actor` sees it: under way, finished or called off. */
export async function stageShown(
  s: ProductHarness,
  actor?: string
): Promise<string> {
  const status = await customGameStatusShown(
    s,
    actor ?? lightCyclesObserver(s)
  );
  return status === 'active'
    ? 'under way'
    : status === 'completed'
      ? 'finished'
      : status === 'cancelled'
        ? 'called off'
        : status;
}

/** What the custom game's status says to `actor`: its lineup, then how the game stands. */
export async function gameStatusText(
  s: ProductHarness,
  actor: string
): Promise<string> {
  return (
    (await (await actorUi(s, actor)).get('custom-game-status').text()) ?? ''
  );
}
