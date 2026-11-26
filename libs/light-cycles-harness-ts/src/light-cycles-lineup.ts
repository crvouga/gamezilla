import {
  establishCustomGame,
  joinCustomGames,
  joinCustomGamesAsGuest,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import { customGameSeatName } from '@libs/game-session-harness-ts/custom-game-reads';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import {
  attemptCustomGame,
  configureCustomGame,
} from '@libs/game-session-harness-ts/custom-game-ui';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { partitioned } from '@libs/harness-ts/observations';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesRiderName,
  lightCyclesBoard,
} from './light-cycles-board-view';

export type LightCyclesCount = 2 | 3 | 4;
export type LightCyclesBotLevel = 'easy' | 'medium' | 'hard';

/** Who rides each rider, in seat order: a person, or a bot at a level. */
export type LightCyclesSeatHolder =
  | { readonly person: string }
  | { readonly bot: LightCyclesBotLevel }
  | { readonly open: true };

/** Everything a scenario said about who is in the game. */
export type LightCyclesLineup = {
  readonly count: LightCyclesCount;
  readonly host: string;
  readonly seats: readonly LightCyclesSeatHolder[];
  /** Watchers signed in, then guests who are not. */
  readonly watchers: readonly string[];
  readonly guests: readonly string[];
  /** Practice runs on the host's device, against bots only. */
  readonly practice: boolean;
  readonly target: number;
};

export const LIGHT_CYCLES_SIDES: readonly GameSide[] = [
  'white',
  'black',
  'red',
  'blue',
];
const GAME_IDS: Readonly<Record<LightCyclesCount, string>> = {
  2: 'light-cycles',
  3: 'light-cycles-3',
  4: 'light-cycles-4',
};
const SEAT_KEYS = ['first', 'second', 'third', 'fourth'] as const;
const COUNTDOWN_SHOWN_MS = 5000;

const lineups = new WeakMap<ProductHarness, LightCyclesLineup>();

export function lightCyclesGameId(count: LightCyclesCount): string {
  return GAME_IDS[count];
}

/** The game this scenario set up. */
export function lightCyclesLineup(s: ProductHarness): LightCyclesLineup {
  const lineup = lineups.get(s);
  if (lineup === undefined)
    throw new Error('No Light Cycles game was set up in this scenario');
  return lineup;
}

export function rememberLineup(s: ProductHarness, lineup: LightCyclesLineup) {
  lineups.set(s, lineup);
}

/** The person who rides `rider`, or null for a bot or a rider not in the mode. */
export function personOf(
  s: ProductHarness,
  rider: LightCyclesRiderName
): string | null {
  const holder =
    lightCyclesLineup(s).seats[LIGHT_CYCLES_RIDER_NAMES.indexOf(rider)];
  return holder !== undefined && 'person' in holder ? holder.person : null;
}

/** Everyone in the space: each rider's person, then every watcher. */
export function everyone(s: ProductHarness): string[] {
  const lineup = lightCyclesLineup(s);
  return [
    ...new Set([
      lineup.host,
      ...lineup.seats.flatMap((holder) =>
        'person' in holder ? [holder.person] : []
      ),
      ...lineup.watchers,
      ...lineup.guests,
    ]),
  ];
}

/** Everyone in the space whose device can see the game now: nobody away. */
export async function everyoneSeeing(s: ProductHarness): Promise<string[]> {
  if (lightCyclesLineup(s).practice) return everyone(s);
  return everyone(s).filter((person) => !isAway(s, person));
}

/** Whether `person`'s device has no connection now. */
export function isAway(s: ProductHarness, person: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(person));
}

/**
 * Whose screen the harness reads the game from: the creator's, or, while
 * they are away, the first person in the space whose device is connected.
 * With everyone away nobody can see what a shared game does now.
 */
export function lightCyclesObserver(s: ProductHarness): string {
  const lineup = lightCyclesLineup(s);
  // Practice runs on its own device: it is seen there, connection or not.
  if (lineup.practice) return lineup.host;
  const seeing = [lineup.host, ...everyone(s)].find(
    (person) => !isAway(s, person)
  );
  if (seeing === undefined)
    throw new Error('Nobody in the space has a connection to see the game');
  return seeing;
}

/** The people riding, in seat order. */
export function ridingPeople(s: ProductHarness): string[] {
  return [
    ...new Set(
      lightCyclesLineup(s).seats.flatMap((holder) =>
        'person' in holder ? [holder.person] : []
      )
    ),
  ];
}

function seatChoice(holder: LightCyclesSeatHolder | undefined) {
  if (holder === undefined || 'open' in holder) return 'open';
  return 'person' in holder ? holder.person : 'bot';
}

/** Every person shows the first round's countdown on their own board. */
async function awaitCountdown(s: ProductHarness): Promise<void> {
  for (const person of everyone(s))
    await pollUntil(
      s,
      async () => {
        const board = await lightCyclesBoard(s, person);
        return board !== null && board.round >= 1 ? true : null;
      },
      {
        maxMs: COUNTDOWN_SHOWN_MS,
        stepMs: 25,
        description: `${person} sees the Light Cycles arena`,
      }
    );
}

/** The creator makes every choice before anyone is ready, then everyone agrees. */
async function prepare(
  s: ProductHarness,
  lineup: LightCyclesLineup
): Promise<void> {
  const gameId = lightCyclesGameId(lineup.count);
  const seats = Object.fromEntries(
    SEAT_KEYS.map((key, index) => [key, seatChoice(lineup.seats[index])])
  );
  await Promise.resolve(
    establishCustomGame.act(s, gameId, {
      host: lineup.host,
      ...seats,
      watchers: lineup.watchers,
      // Practice is a person's own device against bots: no account needed.
      ...(lineup.practice ? { guests: true } : {}),
      ...(lineup.target === 3 ? {} : { configuration: String(lineup.target) }),
      ready: false,
      active: false,
    })
  );
  for (const [index, holder] of lineup.seats.entries())
    if ('bot' in holder && holder.bot !== 'medium')
      await configureCustomGame(s, lineup.host, {
        operation: 'difficulty',
        side: LIGHT_CYCLES_SIDES[index]!,
        difficulty: holder.bot,
      });
  for (const guest of lineup.guests)
    await Promise.resolve(
      joinCustomGamesAsGuest.act(s, gameId, lineup.host, guest)
    );
  await rememberNames(s);
}

const started = new WeakSet<ProductHarness>();
const agreed = new WeakSet<ProductHarness>();

/** Every person seated says they are ready, once. */
async function readyEveryone(s: ProductHarness): Promise<void> {
  if (agreed.has(s)) return;
  for (const person of ridingPeople(s))
    await configureCustomGame(s, person, { operation: 'ready' });
  agreed.add(s);
}

/** The people a scenario may seat in a rider left open, in this order. */
const FILLERS = ['bob', 'carol', 'dave', 'eve'] as const;

/** `person` takes the open seat `index`: invited by the creator, accepting. */
export async function seatPerson(
  s: ProductHarness,
  person: string,
  index: number
): Promise<void> {
  const lineup = lightCyclesLineup(s);
  const side = LIGHT_CYCLES_SIDES[index]!;
  await Promise.resolve(
    joinCustomGames.act(s, lightCyclesGameId(lineup.count), lineup.host, person)
  );
  const id = (await readCustomGameScreen(s, person))?.me;
  if (id === undefined) throw new Error(`${person} sees no custom game`);
  await configureCustomGame(s, lineup.host, {
    operation: 'invite',
    side,
    person: id,
  });
  await configureCustomGame(s, person, { operation: 'accept', side });
  const seats = [...lineup.seats];
  seats[index] = { person };
  rememberLineup(s, { ...lineup, seats });
  await rememberNames(s);
}

/**
 * A game cannot start with a rider nobody rides. Practice gives each open
 * rider a bot; a game shared with people seats the next person of the
 * scenario in it, so it stays a game people share.
 */
async function fillOpenSeats(s: ProductHarness) {
  for (const [index, holder] of lightCyclesLineup(s).seats.entries()) {
    if (!('open' in holder)) continue;
    const lineup = lightCyclesLineup(s);
    if (lineup.practice) {
      await configureCustomGame(s, lineup.host, {
        operation: 'bot',
        side: LIGHT_CYCLES_SIDES[index]!,
      });
      const seats = [...lineup.seats];
      seats[index] = { bot: 'medium' };
      rememberLineup(s, { ...lineup, seats });
      continue;
    }
    const person = FILLERS.find((name) => !everyone(s).includes(name));
    if (person === undefined) throw new Error('No person left to seat');
    await seatPerson(s, person, index);
  }
}

const names = new WeakMap<ProductHarness, Map<string, string>>();

/** What the custom game's seats call each person riding, as the creator's screen shows it. */
async function rememberNames(s: ProductHarness): Promise<void> {
  const lineup = lightCyclesLineup(s);
  const shown = names.get(s) ?? new Map<string, string>();
  names.set(s, shown);
  for (const [index, holder] of lineup.seats.entries())
    if ('person' in holder)
      shown.set(
        holder.person,
        (
          (await customGameSeatName(
            s,
            lineup.host,
            LIGHT_CYCLES_SIDES[index]!
          )) ?? ''
        ).trim()
      );
}

/** The name the custom game showed for `person` while it was set up. */
export function shownNameOf(
  s: ProductHarness,
  person: string
): Promise<string> {
  const name = names.get(s)?.get(person);
  if (name === undefined) throw new Error(`No name was shown for ${person}`);
  return Promise.resolve(name);
}

async function agree(s: ProductHarness, lineup: LightCyclesLineup) {
  if (!agreed.has(s)) await fillOpenSeats(s);
  await readyEveryone(s);
  await configureCustomGame(s, lineup.host, { operation: 'start' });
  started.add(s);
  await awaitCountdown(s);
}

/** Who rides each rider, by name; riders left out are open. */
export type LightCyclesGameSetup = {
  readonly count: LightCyclesCount;
  readonly riders: Partial<
    Record<LightCyclesRiderName, string | { readonly bot: LightCyclesBotLevel }>
  >;
  readonly host?: string;
  readonly watchers?: readonly string[];
  readonly guests?: readonly string[];
  readonly target?: number;
  readonly practice?: boolean;
};

function lineupOf(setup: LightCyclesGameSetup): LightCyclesLineup {
  const seats = LIGHT_CYCLES_RIDER_NAMES.slice(0, setup.count).map(
    (name): LightCyclesSeatHolder => {
      const holder = setup.riders[name];
      if (holder === undefined) return { open: true };
      return typeof holder === 'string' ? { person: holder } : holder;
    }
  );
  const first = seats[0];
  return {
    count: setup.count,
    host:
      setup.host ??
      (first !== undefined && 'person' in first ? first.person : 'alice'),
    seats,
    watchers: setup.watchers ?? [],
    guests: setup.guests ?? [],
    practice: setup.practice ?? false,
    target: setup.target ?? 3,
  };
}

/**
 * A Light Cycles custom game through the ordinary space and game choices:
 * the creator seats people and bots, chooses the target score and the bots'
 * levels, and everyone seated gets ready. It starts when the scenario first
 * needs it under way ({@link startedLightCycles}), or at once with
 * `startNow`; its first round then counts down on every person's board.
 */
export const establishLightCyclesGame = scenarioAction({
  name: 'establishLightCyclesGame',
  act: async (s, setup: LightCyclesGameSetup, startNow: boolean = false) => {
    const lineup = lineupOf(setup);
    rememberLineup(s, lineup);
    await prepare(s, lineup);
    if (startNow) await agree(s, lineup);
  },
});

/** Whether the creator has started the custom game yet. */
export function lightCyclesStarted(s: ProductHarness): boolean {
  return started.has(s);
}

/**
 * The game the scenario set up, under way: if nobody has started it yet,
 * everyone seated gets ready and the creator starts it now.
 */
export async function startedLightCycles(s: ProductHarness): Promise<void> {
  if (!started.has(s)) await agree(s, lightCyclesLineup(s));
}

/** The creator starts the custom game, as a person does, refused or not. */
export const startLightCyclesGame = scenarioAction({
  name: 'startLightCyclesGame',
  act: async (s) => {
    if (!started.has(s)) {
      await agree(s, lightCyclesLineup(s));
      return;
    }
    await Promise.resolve(
      attemptCustomGame.act(s, lightCyclesLineup(s).host, {
        operation: 'start',
      })
    );
  },
});

/** The game the scenario set up, with every rider's person ready and the game not yet started. */
export const readyLightCyclesGame = scenarioAction({
  name: 'readyLightCyclesGame',
  act: async (s) => {
    await fillOpenSeats(s);
    await readyEveryone(s);
  },
});

/**
 * `person` joins the creator's space from its link and opens the mode's
 * custom games, as anyone the link is shared with does; from then on they
 * are one of everyone in the space.
 */
export const joinLightCycles = scenarioAction({
  name: 'joinLightCycles',
  act: async (s, person: string) => {
    const lineup = lightCyclesLineup(s);
    await Promise.resolve(
      joinCustomGames.act(
        s,
        lightCyclesGameId(lineup.count),
        lineup.host,
        person
      )
    );
    rememberLineup(s, { ...lineup, watchers: [...lineup.watchers, person] });
  },
});

/** The people of a scenario in seat order, one per rider of the mode. */
const SEAT_PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

/**
 * A custom game of the mode with a person on every rider (Alice, Bob,
 * Carol, Dave in seat order), everyone ready, not started yet.
 */
export const establishEveryRiderReady = scenarioAction({
  name: 'establishEveryRiderReady',
  act: async (s, count: LightCyclesCount) => {
    const riders = Object.fromEntries(
      LIGHT_CYCLES_RIDER_NAMES.slice(0, count).map((name, index) => [
        name,
        SEAT_PEOPLE[index]!,
      ])
    );
    await Promise.resolve(establishLightCyclesGame.act(s, { count, riders }));
    await Promise.resolve(readyLightCyclesGame.act(s));
  },
});
