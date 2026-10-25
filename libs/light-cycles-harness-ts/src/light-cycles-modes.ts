import { pairUpWaitingPeople } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { pickGame } from '@libs/game-session-harness-ts/game-navigation';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesRiderName,
  lightCyclesBoard,
} from './light-cycles-board-view';
import {
  establishLightCyclesGame,
  type LightCyclesBotLevel,
  type LightCyclesCount,
  type LightCyclesSeatHolder,
  lightCyclesGameId,
  lightCyclesLineup,
  lightCyclesStarted,
  rememberLineup,
  seatPerson,
  startLightCyclesGame,
} from './light-cycles-lineup';

const PAIRED_MS = 5000;

/** `person` takes `rider` in the creator's custom game, invited and accepting. */
export const takeLightCyclesSeat = scenarioAction({
  name: 'takeLightCyclesSeat',
  act: (s, person: string, rider: LightCyclesRiderName) =>
    seatPerson(s, person, LIGHT_CYCLES_RIDER_NAMES.indexOf(rider)),
});

/**
 * `actor` starts practice: Light Cycles on their own device with a bot of
 * `level` on every other rider. Practice already set up is started again,
 * as a person asking for it again would.
 */
export const startPractice = scenarioAction({
  name: 'startPractice',
  act: async (
    s,
    actor: string,
    count: LightCyclesCount,
    level: LightCyclesBotLevel
  ) => {
    let practising = false;
    try {
      practising = lightCyclesLineup(s).practice;
    } catch {
      practising = false;
    }
    if (practising && lightCyclesStarted(s)) {
      await Promise.resolve(startLightCyclesGame.act(s));
      return;
    }
    await Promise.resolve(establishPractice.act(s, { actor, count, level }));
  },
});

/** Practice on a person's device against bots of one level, started unless `start` is false. */
export type LightCyclesPractice = {
  readonly actor: string;
  readonly count: LightCyclesCount;
  readonly level: LightCyclesBotLevel;
  readonly start?: boolean;
  readonly target?: number;
};

export const establishPractice = scenarioAction({
  name: 'establishPractice',
  act: async (s, practice: LightCyclesPractice) => {
    const { actor, count, level } = practice;
    const riders = Object.fromEntries(
      LIGHT_CYCLES_RIDER_NAMES.slice(0, count).map((name, index) => [
        name,
        index === 0 ? actor : { bot: level },
      ])
    );
    await Promise.resolve(
      establishLightCyclesGame.act(
        s,
        {
          count,
          host: actor,
          riders,
          practice: true,
          target: practice.target ?? 3,
        },
        practice.start ?? true
      )
    );
  },
});

/** `actor` creates a space and `person` joins it from its link. */
export const joinSpaceOf = scenarioAction({
  name: 'joinSpaceOf',
  act: async (s, person: string, host: string) => {
    for (const actor of [host, person])
      await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(createSpace.act(s, host));
    const link = await readSpaceLink(s, host);
    if (link === null) throw new Error(`${host} has no space link`);
    await Promise.resolve(joinViaLink.act(s, person, link));
  },
});

/** The host picks the mode as the space's game. */
export const pickLightCyclesMode = scenarioAction({
  name: 'pickLightCyclesMode',
  act: (s, host: string, count: LightCyclesCount) =>
    pickGame.act(s, host, lightCyclesGameId(count)),
});

const seekers = new WeakMap<ProductHarness, Map<string, LightCyclesCount>>();

/** Each person finds players for the mode, from their own space. */
export const findPlayers = scenarioAction({
  name: 'findPlayers',
  act: async (s, people: readonly string[], count: LightCyclesCount) => {
    const finding = seekers.get(s) ?? new Map<string, LightCyclesCount>();
    seekers.set(s, finding);
    for (const person of people) {
      await Promise.resolve(
        seekGameOpponent.act(s, person, lightCyclesGameId(count))
      );
      finding.set(person, count);
    }
  },
});

/** Whether `person` is still waiting to be paired up. */
export async function stillFindingPlayers(
  s: ProductHarness,
  person: string
): Promise<boolean> {
  return (await opponentSearchView(s, person)).waiting;
}

/**
 * Matchmaking pairs up whoever it can. A whole mode's worth of people
 * finding players for it is shown its arena; the scenario then knows who
 * rides which rider by what each person's own board lets them steer.
 */
export const pairPeopleUp = scenarioAction({
  name: 'pairPeopleUp',
  act: async (s) => {
    const finding = [...(seekers.get(s) ?? new Map()).entries()];
    await Promise.resolve(pairUpWaitingPeople.act(s, finding[0]?.[0]));
    for (const count of [2, 3, 4] as const) {
      const people = finding
        .filter(([, mode]) => mode === count)
        .map(([person]) => person);
      if (people.length !== count) continue;
      const seats: LightCyclesSeatHolder[] = LIGHT_CYCLES_RIDER_NAMES.slice(
        0,
        count
      ).map(() => ({ open: true }));
      for (const person of people) {
        const own = await pollUntil(
          s,
          async () => {
            const index =
              (await lightCyclesBoard(s, person))?.riders.findIndex(
                (rider) => rider.steeredHere
              ) ?? -1;
            return index >= 0 ? index : null;
          },
          {
            maxMs: PAIRED_MS,
            stepMs: 50,
            description: `${person}'s found game`,
          }
        );
        seats[own] = { person };
      }
      rememberLineup(s, {
        count,
        host: people[0]!,
        seats,
        watchers: [],
        guests: [],
        practice: false,
        target: 3,
      });
    }
  },
});

/** The rider `person`'s own board lets them steer in a found game, if any. */
export async function riderFoundFor(
  s: ProductHarness,
  person: string
): Promise<LightCyclesRiderName | null> {
  const board = await lightCyclesBoard(s, person);
  return board?.riders.find((rider) => rider.steeredHere)?.name ?? null;
}
