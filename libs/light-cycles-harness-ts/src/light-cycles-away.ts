import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesDirection,
  type LightCyclesRiderName,
  lightCyclesBoard,
  lightCyclesBoardShown,
} from './light-cycles-board-view';
import { connectionBack, loseConnection } from './light-cycles-game-actions';
import {
  everyone,
  isAway,
  joinLightCycles,
  lightCyclesLineup,
  lightCyclesObserver,
  personOf,
} from './light-cycles-lineup';
import { steerRider } from './light-cycles-person-steering';
import { steeringShown } from './light-cycles-reads';
import { reachRoundRiding } from './light-cycles-riding-actions';

/** An away person's rider crashes after 3 seconds; a little more lets every board show it. */
const AWAY_CRASH_MS = 4000;
const WIDTH = 40;
const HEIGHT = 28;

/** `person`'s device has no connection from now on: they are away. */
export const goAway = scenarioAction({
  name: 'goAway',
  act: (s, person: string) => loseConnection(s, person),
});

/** How long a device that reconnects takes to show the game as it is now. */
const CAUGHT_UP_MS = 5000;

/**
 * `person`'s device reaches everyone again; time runs until it shows the
 * game as it is now, no longer as it was when the connection went.
 */
export const comeBack = scenarioAction({
  name: 'comeBack',
  act: async (s, person: string) => {
    await connectionBack(s, person);
    await pollUntil(
      s,
      async () => {
        const board = await lightCyclesBoard(s, person);
        return board === null || board.steering !== 'away' ? true : null;
      },
      {
        maxMs: CAUGHT_UP_MS,
        stepMs: 50,
        description: `${person}'s device catching up`,
      }
    );
  },
});

const STEP: Readonly<Record<LightCyclesDirection, readonly [number, number]>> =
  { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SIDES: Readonly<
  Record<
    LightCyclesDirection,
    readonly [LightCyclesDirection, LightCyclesDirection]
  >
> = {
  up: ['left', 'right'],
  down: ['left', 'right'],
  left: ['up', 'down'],
  right: ['up', 'down'],
};

/** How many open cells lie ahead of `from` in `heading`, before an edge or a trail. */
function openRoad(
  taken: ReadonlySet<string>,
  from: { readonly column: number; readonly row: number },
  heading: LightCyclesDirection
): number {
  const [dx, dy] = STEP[heading];
  let cells = 0;
  for (
    let column = from.column + dx, row = from.row + dy;
    column >= 1 &&
    column <= WIDTH &&
    row >= 1 &&
    row <= HEIGHT &&
    !taken.has(`${String(column)},${String(row)}`);
    column += dx, row += dy
  )
    cells += 1;
  return cells;
}

/**
 * Everyone still here keeps their rider riding, as a person would: a rider
 * two cells from an edge or a trail turns toward the side with more open
 * road.
 */
async function keepRiding(
  s: ProductHarness,
  board: Awaited<ReturnType<typeof lightCyclesBoardShown>>
): Promise<void> {
  const taken = new Set(board.riders.flatMap((rider) => rider.trail));
  for (const rider of board.riders) {
    const person = personOf(s, rider.name);
    if (!rider.riding || person === null || isAway(s, person)) continue;
    if (openRoad(taken, rider, rider.heading) > 2) continue;
    const [left, right] = SIDES[rider.heading];
    const turn =
      openRoad(taken, rider, left) >= openRoad(taken, rider, right)
        ? left
        : right;
    await steerRider(s, { rider: rider.name, heading: turn });
  }
}

/** The rider `person` rides. */
function riderOf(s: ProductHarness, person: string): LightCyclesRiderName {
  const index = lightCyclesLineup(s).seats.findIndex(
    (holder) => 'person' in holder && holder.person === person
  );
  if (index < 0) throw new Error(`${person} rides no rider`);
  return LIGHT_CYCLES_RIDER_NAMES[index]!;
}

/**
 * Round `round` is under way and `people` lose their connection in it;
 * time runs until each of their riders has crashed for being away.
 */
export const stayAwayInRound = scenarioAction({
  name: 'stayAwayInRound',
  act: async (s, people: readonly string[], round: number) => {
    await Promise.resolve(reachRoundRiding.act(s, round));
    for (const person of people) await loseConnection(s, person);
    await pollUntil(
      s,
      async () => {
        const board = await lightCyclesBoardShown(s, lightCyclesObserver(s));
        await keepRiding(s, board);
        return people.every(
          (person) =>
            board.riders.find((rider) => rider.name === riderOf(s, person))
              ?.riding === false
        )
          ? true
          : null;
      },
      {
        maxMs: AWAY_CRASH_MS,
        stepMs: 50,
        description: `${people.join(' and ')}'s riders crashing while away`,
      }
    );
  },
});

/** Whether `person` can steer their own rider on their device now, and what it says. */
export async function ownRiderSteering(s: ProductHarness, person: string) {
  return steeringShown(s, person, riderOf(s, person));
}

/**
 * `watcher` watches the game from the creator's space with a connection.
 * A person joins a space only while its host is there. With the host away,
 * everyone away comes back while the watcher joins and they all go away
 * again together, so they have been away equally long from the moment this
 * is set up, as they were before.
 */
export const watchWithConnection = scenarioAction({
  name: 'watchWithConnection',
  act: async (s, watcher: string) => {
    const host = lightCyclesLineup(s).host;
    const away = isAway(s, host)
      ? everyone(s).filter((person) => isAway(s, person))
      : [];
    for (const person of away) await connectionBack(s, person);
    await Promise.resolve(joinLightCycles.act(s, watcher));
    for (const person of away) await loseConnection(s, person);
    await pollUntil(
      s,
      async () => ((await lightCyclesBoard(s, watcher)) === null ? null : true),
      {
        maxMs: CAUGHT_UP_MS,
        stepMs: 50,
        description: `${watcher} watching the game`,
      }
    );
  },
});
