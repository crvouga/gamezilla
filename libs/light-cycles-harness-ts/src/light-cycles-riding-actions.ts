import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { restoreLightCyclesArena } from './light-cycles-arena-fixture';
import {
  arenaState,
  EMPTY_ARENA_PLAN,
  type LightCyclesArenaPlan,
  planHolds,
} from './light-cycles-arena-plan';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesBoardShown,
  type LightCyclesDirection,
  type LightCyclesRiderName,
  lightCyclesBoardShown,
} from './light-cycles-board-view';
import {
  isAway,
  lightCyclesLineup,
  lightCyclesObserver,
  personOf,
  startedLightCycles,
} from './light-cycles-lineup';
import { steerRider, steerWhenOffered } from './light-cycles-person-steering';

/** One step is 100 ms; a wait this short never mistakes a later step for it. */
const STEP_POLL_MS = 10;
const ARENA_SHOWN_MS = 2000;
const COUNTDOWN_MS = 5000;
const ROUND_ENDS_MS = 15_000;
const WIDTH = 40;
const HEIGHT = 28;

const plans = new WeakMap<ProductHarness, LightCyclesArenaPlan>();

/** The person who sees the arena for the harness. */
function observer(s: ProductHarness): string {
  return lightCyclesObserver(s);
}

function signature(board: LightCyclesBoardShown): string {
  return JSON.stringify(
    board.riders.map((rider) => [rider.column, rider.row, rider.riding])
  );
}

function ridByBot(s: ProductHarness, name: string): boolean {
  const holder =
    lightCyclesLineup(s).seats[
      LIGHT_CYCLES_RIDER_NAMES.indexOf(name as LightCyclesRiderName)
    ];
  return holder !== undefined && 'bot' in holder;
}

function merged(
  plan: LightCyclesArenaPlan,
  change: Partial<LightCyclesArenaPlan>
): LightCyclesArenaPlan {
  const trails = { ...plan.trails };
  for (const [name, cells] of Object.entries(change.trails ?? {}))
    trails[name as LightCyclesRiderName] = [
      ...(trails[name as LightCyclesRiderName] ?? []),
      ...cells,
    ];
  return {
    placed: { ...plan.placed, ...change.placed },
    trails,
    anyTrails: [...plan.anyTrails, ...(change.anyTrails ?? [])],
    crashedAside: [
      ...(plan.crashedAside ?? []),
      ...(change.crashedAside ?? []),
    ],
  };
}

/**
 * The arena the scenario states so far, every rider riding at the pace of a
 * game under way: the riders a person rides are set one cell behind and the
 * arena's next step brings them where the scenario puts them; a rider a bot
 * rides is set on its cell itself, since a bot chooses its own steps.
 */
export const placeLightCyclesArena = scenarioAction({
  name: 'placeLightCyclesArena',
  act: async (s, change: Partial<LightCyclesArenaPlan>) => {
    await startedLightCycles(s);
    const plan = merged(plans.get(s) ?? EMPTY_ARENA_PLAN, change);
    plans.set(s, plan);
    const direct = Object.keys(plan.placed).some((name) => ridByBot(s, name));
    await restoreLightCyclesArena(s, (saved) =>
      arenaState(saved, plan, !direct)
    );
    await pollUntil(
      s,
      async () =>
        planHolds(plan, await lightCyclesBoardShown(s, observer(s)))
          ? true
          : null,
      {
        maxMs: ARENA_SHOWN_MS,
        stepMs: STEP_POLL_MS,
        description: 'the arena the scenario states',
      }
    );
  },
});

/** Time runs until every riding rider has taken one more step. */
export const takeNextStep = scenarioAction({
  name: 'takeNextStep',
  act: async (s) => {
    await startedLightCycles(s);
    const before = signature(await lightCyclesBoardShown(s, observer(s)));
    await pollUntil(
      s,
      async () =>
        signature(await lightCyclesBoardShown(s, observer(s))) !== before
          ? true
          : null,
      {
        maxMs: ARENA_SHOWN_MS,
        stepMs: STEP_POLL_MS,
        description: 'the riders’ next step',
      }
    );
  },
});

/** Time runs until the round's countdown is over and riding begins. */
export const endCountdown = scenarioAction({
  name: 'endCountdown',
  act: async (s) => {
    await startedLightCycles(s);
    await pollUntil(
      s,
      async () =>
        (await lightCyclesBoardShown(s, observer(s))).phase === 'running'
          ? true
          : null,
      {
        maxMs: COUNTDOWN_MS,
        stepMs: STEP_POLL_MS,
        description: 'the end of the countdown',
      }
    );
  },
});

type Toward = {
  readonly heading: LightCyclesDirection;
  readonly cells: number;
};

/** The way to the nearest edge a rider can turn to, and how far it is. */
export function nearestEdge(rider: {
  readonly column: number;
  readonly row: number;
  readonly heading: LightCyclesDirection;
}): Toward {
  const back = (
    { up: 'down', down: 'up', left: 'right', right: 'left' } as const
  )[rider.heading];
  const ways: Toward[] = [
    { heading: 'up', cells: rider.row - 1 },
    { heading: 'down', cells: HEIGHT - rider.row },
    { heading: 'left', cells: rider.column - 1 },
    { heading: 'right', cells: WIDTH - rider.column },
  ];
  return ways
    .filter((way) => way.heading !== back)
    .reduce((best, way) => (way.cells < best.cells ? way : best));
}

/**
 * Each named rider's person steers it toward the nearest edge; time runs
 * until each has crashed. A rider a bot rides, or whose person is away, is
 * steered by nobody: time runs until it crashes by itself. Riders crashing
 * `together` must be the same distance from their edges.
 */
function steeredBySomeone(s: ProductHarness, rider: LightCyclesRiderName) {
  const person = personOf(s, rider);
  return person !== null && !isAway(s, person);
}

async function crash(
  s: ProductHarness,
  names: readonly LightCyclesRiderName[],
  together: boolean
): Promise<void> {
  await startedLightCycles(s);
  const board = await lightCyclesBoardShown(s, observer(s));
  const riders = names.map(
    (name) => board.riders.find((rider) => rider.name === name)!
  );
  const ways = riders.map((rider) => nearestEdge(rider));
  if (together && new Set(ways.map((way) => way.cells)).size > 1)
    throw new Error(`${names.join(' and ')} cannot crash at the same step`);
  for (const [index, rider] of riders.entries())
    if (
      ways[index]!.heading !== rider.heading &&
      steeredBySomeone(s, rider.name)
    )
      await steerWhenOffered(s, {
        rider: rider.name,
        heading: ways[index]!.heading,
      });
  await pollUntil(
    s,
    async () => {
      const shown = await lightCyclesBoardShown(s, observer(s));
      // A round can end before every one of them has crashed.
      return shown.round !== board.round ||
        (shown.phase !== 'running' && shown.phase !== 'countdown') ||
        names.every(
          (name) =>
            shown.riders.find((rider) => rider.name === name)?.riding === false
        )
        ? true
        : null;
    },
    {
      maxMs: ROUND_ENDS_MS,
      stepMs: STEP_POLL_MS,
      description: `${names.join(' and ')} crashing`,
    }
  );
}

export const crashRiders = scenarioAction({
  name: 'crashRiders',
  act: (s, names: readonly LightCyclesRiderName[], together: boolean = false) =>
    crash(s, names, together),
});

async function phaseShown(s: ProductHarness, phase: string): Promise<void> {
  await pollUntil(
    s,
    async () =>
      (await lightCyclesBoardShown(s, observer(s))).phase === phase
        ? true
        : null,
    {
      maxMs: ROUND_ENDS_MS,
      stepMs: STEP_POLL_MS,
      description: `the ${phase} phase`,
    }
  );
}

/**
 * The round under way ends: every riding rider a present person rides but
 * the first crashes; riders nobody steers crash on their own.
 */
async function endRound(s: ProductHarness): Promise<void> {
  const board = await lightCyclesBoardShown(s, observer(s));
  // A rider whose person is away is steered by nobody: it retires by itself.
  const steered = board.riders.filter((rider) => {
    const person = personOf(s, rider.name);
    return rider.riding && person !== null && !isAway(s, person);
  });
  if (steered.length > 1)
    await crash(
      s,
      steered.slice(1).map((r) => r.name),
      false
    );
  await phaseShown(s, 'round-over');
}

/** Rounds are played, by crashing riders, until round `round` counts down. */
async function reachCountdown(s: ProductHarness, round: number) {
  await startedLightCycles(s);
  for (;;) {
    const board = await lightCyclesBoardShown(s, observer(s));
    if (board.round === round && board.phase === 'countdown') return;
    if (board.round > round || board.phase === 'completed')
      throw new Error(`Round ${String(round)} can no longer count down`);
    if (board.phase === 'countdown') await phaseShown(s, 'running');
    else if (board.phase === 'running') await endRound(s);
    else await phaseShown(s, 'countdown');
  }
}

export const reachRoundCountdown = scenarioAction({
  name: 'reachRoundCountdown',
  act: reachCountdown,
});

/** Rounds are played until round `round` is under way, its countdown over. */
export const reachRoundRiding = scenarioAction({
  name: 'reachRoundRiding',
  act: async (s, round: number) => {
    await reachCountdown(s, round);
    await phaseShown(s, 'running');
  },
});

/** Every other rider crashes in round `round`, so `winner` wins it; its result shows. */
export const winRound = scenarioAction({
  name: 'winRound',
  act: async (s, winner: LightCyclesRiderName, round: number) => {
    await reachCountdown(s, round);
    const board = await lightCyclesBoardShown(s, observer(s));
    await crash(
      s,
      board.riders.map((rider) => rider.name).filter((name) => name !== winner),
      false
    );
    await phaseShown(s, 'round-over');
  },
});

/** One step before round `round` ends, `actor` steers `rider` `heading`. */
export const steerAsRoundEnds = scenarioAction({
  name: 'steerAsRoundEnds',
  act: async (
    s,
    steer: {
      readonly rider: LightCyclesRiderName;
      readonly heading: LightCyclesDirection;
    },
    round: number
  ) => {
    await reachCountdown(s, round);
    const board = await lightCyclesBoardShown(s, observer(s));
    const others = board.riders.filter((rider) => rider.name !== steer.rider);
    for (const rider of others) {
      const way = nearestEdge(rider);
      if (way.heading !== rider.heading)
        await steerWhenOffered(s, { rider: rider.name, heading: way.heading });
    }
    await pollUntil(
      s,
      async () => {
        const shown = await lightCyclesBoardShown(s, observer(s));
        return shown.riders.some(
          (rider) =>
            rider.name !== steer.rider &&
            rider.riding &&
            nearestEdge(rider).cells === 0
        )
          ? true
          : null;
      },
      {
        maxMs: ROUND_ENDS_MS,
        stepMs: STEP_POLL_MS,
        description: 'the last step of the round',
      }
    );
    await steerRider(s, steer);
    await phaseShown(s, 'round-over');
  },
});

/** Rounds are played until round `round` has just ended: its result shows. */
export const reachRoundEnd = scenarioAction({
  name: 'reachRoundEnd',
  act: async (s, round: number) => {
    await startedLightCycles(s);
    const board = await lightCyclesBoardShown(s, observer(s));
    if (board.round === round && board.phase === 'round-over') return;
    if (board.round !== round || board.phase !== 'running')
      await reachCountdown(s, round);
    await phaseShown(s, 'running');
    await endRound(s);
  },
});

/** Edge cells a rider heading left is boxed in at, with the trails around it. */
const BOXES = [
  { row: 26, trails: [25, 27] },
  { row: 22, trails: [21, 23] },
  { row: 18, trails: [17, 19] },
] as const;

/**
 * Every rider a bot rides heads into the edge of the arena from a cell
 * boxed in by trails: whatever the bot steers, its next step crashes it.
 */
export const boxInBotRiders = scenarioAction({
  name: 'boxInBotRiders',
  act: async (s) => {
    const bots = LIGHT_CYCLES_RIDER_NAMES.filter((name) => ridByBot(s, name));
    await Promise.resolve(
      placeLightCyclesArena.act(s, {
        placed: Object.fromEntries(
          bots.map((name, index) => [
            name,
            {
              column: 1,
              row: BOXES[index]!.row,
              heading: 'left' as const,
              riding: true,
            },
          ])
        ),
        anyTrails: bots.flatMap((_, index) => [
          ...BOXES[index]!.trails.map((row) => ({ column: 1, row })),
          { column: 2, row: BOXES[index]!.row },
        ]),
      })
    );
  },
});
