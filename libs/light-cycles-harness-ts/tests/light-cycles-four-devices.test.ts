import { expect, test } from 'bun:test';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesDirection,
  type LightCyclesRiderName,
  lightCyclesBoard,
  lightCyclesBoardShown,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  findPlayers,
  pairPeopleUp,
  riderFoundFor,
} from '@libs/light-cycles-harness-ts/light-cycles-modes';
import { steerLightCyclesRider } from '@libs/light-cycles-harness-ts/light-cycles-person-steering';
import {
  gameSeenBy,
  steeringShown,
} from '@libs/light-cycles-harness-ts/light-cycles-reads';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openHarness } from './open-light-cycles-harness';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;
const WATCHER = 'eve';
const EVERYONE = [...PEOPLE, WATCHER] as const;
const TURN: Readonly<Record<LightCyclesDirection, LightCyclesDirection>> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};
const ARROWS = ['up', 'right', 'down', 'left'] as const;

/** The phase every device shows, or null while they differ. */
async function phaseEveryoneSees(s: ProductHarness): Promise<string | null> {
  const phases = new Set<string | undefined>();
  for (const person of EVERYONE)
    phases.add((await lightCyclesBoard(s, person))?.phase);
  return phases.size === 1 ? ([...phases][0] ?? null) : null;
}

/** Whether every device shows the same arena, trails, riders, scores and round as Alice's. */
async function everyoneSeesAlicesGame(s: ProductHarness): Promise<boolean> {
  const alice = JSON.stringify(await gameSeenBy(s, 'alice'));
  for (const person of EVERYONE.slice(1))
    if (JSON.stringify(await gameSeenBy(s, person)) !== alice) return false;
  return true;
}

/** Each rider's chosen next heading, as Alice's device shows it. */
async function nextHeadings(
  s: ProductHarness
): Promise<Record<string, LightCyclesDirection>> {
  return Object.fromEntries(
    (await lightCyclesBoardShown(s, 'alice')).riders.map((rider) => [
      rider.name,
      rider.next,
    ])
  );
}

test('four people ride one found Quad on their own devices while a fifth person watches', async () => {
  await using s = await openHarness('light-cycles-four-devices');
  await s.apply(findPlayers, PEOPLE, 4);
  await s.apply(pairPeopleUp);

  // Paired into one game: four different riders, each steered on one device.
  const riders = new Map<string, LightCyclesRiderName>();
  for (const person of PEOPLE) {
    const rider = await s.read(riderFoundFor, person);
    expect(rider).not.toBeNull();
    riders.set(person, rider!);
    const board = await s.read(lightCyclesBoardShown, person);
    expect(
      board.riders.filter((each) => each.steeredHere).map((each) => each.name)
    ).toEqual([rider!]);
  }
  expect(new Set(riders.values())).toEqual(new Set(LIGHT_CYCLES_RIDER_NAMES));

  // A fifth person arrives in Alice's space after the game was found.
  await s.apply(signInWithGoogle, WATCHER);
  const link = await s.read(readSpaceLink, 'alice');
  expect(link).not.toBeNull();
  await s.apply(joinViaLink, WATCHER, link!);
  await s.until(phaseEveryoneSees, {
    maxMs: 5000,
    stepMs: 100,
    pred: (phase) => phase === 'running',
  });
  const watched = await s.read(lightCyclesBoardShown, WATCHER);
  expect(watched.riders.some((each) => each.steeredHere)).toBe(false);

  // Each person turns their own rider with its pad, on their own device.
  const turns = new Map<LightCyclesRiderName, LightCyclesDirection>();
  for (const [person, rider] of riders) {
    expect((await s.read(steeringShown, person, rider)).offered).toBe(true);
    const shown = await s.read(lightCyclesBoardShown, person);
    const heading =
      TURN[shown.riders.find((each) => each.name === rider)!.heading];
    await s.apply(steerLightCyclesRider, { rider, heading, device: person });
    turns.set(rider, heading);
  }
  await s.until(lightCyclesBoardShown, {
    maxMs: 1000,
    stepMs: 10,
    pred: (board) =>
      board.riders.every((each) => each.heading === turns.get(each.name)),
  });
  await s.until(everyoneSeesAlicesGame, {
    maxMs: 1000,
    stepMs: 5,
    pred: (same) => same,
  });

  // Nobody else's gesture steers a rider: the watcher's pads and arrow keys,
  // and Bob's reach for Alice's rider, change no rider's next heading.
  const before = await s.read(nextHeadings);
  for (const rider of LIGHT_CYCLES_RIDER_NAMES) {
    expect((await s.read(steeringShown, WATCHER, rider)).offered).toBe(false);
    await s.apply(steerLightCyclesRider, {
      rider,
      heading: TURN[before[rider]!],
      device: WATCHER,
    });
  }
  for (const arrow of ARROWS)
    await s.apply(steerLightCyclesRider, {
      rider: riders.get('alice')!,
      heading: arrow,
      device: WATCHER,
      way: { arrow },
    });
  const alicesRider = riders.get('alice')!;
  expect((await s.read(steeringShown, 'bob', alicesRider)).offered).toBe(false);
  await s.apply(steerLightCyclesRider, {
    rider: alicesRider,
    heading: TURN[before[alicesRider]!],
    device: 'bob',
  });
  expect(await s.read(nextHeadings)).toEqual(before);

  // Play goes on to the round's result, the same on all five devices.
  await s.until(phaseEveryoneSees, {
    maxMs: 30_000,
    stepMs: 250,
    pred: (phase) => phase === 'round-over',
  });
  await s.until(everyoneSeesAlicesGame, {
    maxMs: 1000,
    stepMs: 5,
    pred: (same) => same,
  });
  const result = await s.read(gameSeenBy, WATCHER);
  expect(result.round).toBe(1);
  expect(result.riders.filter((each) => each.riding).length).toBeLessThan(2);
}, 180_000);
