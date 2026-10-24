import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import type { SimulationInput } from '@pkgs/turn-game-shared-ts/simulation';

/** Author-decided examples, including an unfinished state that reaches its result. */
export type SimulationHarnessFixtures = {
  readonly refusedInputs: readonly unknown[];
  readonly examples: readonly {
    readonly seed: string;
    readonly initialPosition: string;
    readonly inputs: readonly SimulationInput<unknown>[];
    readonly ticks: number;
    readonly expectedPosition: string;
  }[];
};

/** A game's declared opening, with the real session seed for seeded mechanics. */
export function initialHarnessPosition(
  game: GameRegistration,
  seed: string
): string {
  const simulation = game.registration.simulation;
  return simulation === undefined
    ? game.registration.rules.initial()
    : simulation.codec.encode(simulation.initialize(seed));
}

export function assertSimulationFixtures(
  simulation: RegisteredSimulation,
  fixtures: SimulationHarnessFixtures,
  fail: (problem: string) => never
): void {
  if (fixtures.refusedInputs.length === 0)
    fail('name at least one refused simulation input');
  for (const value of fixtures.refusedInputs)
    if (simulation.parseInput(value) !== null)
      fail('a refused simulation input is accepted');
  if (fixtures.examples.length === 0)
    fail('name independent simulation examples');
  const terminal = fixtures.examples.map((example) =>
    checkExample(simulation, example, fail)
  );
  if (!terminal.includes(true))
    fail('name an unfinished simulation example that reaches its result');
}

function checkExample(
  simulation: RegisteredSimulation,
  example: SimulationHarnessFixtures['examples'][number],
  fail: (problem: string) => never
): boolean {
  const initial = simulation.codec.decode(example.initialPosition);
  const expected = simulation.codec.decode(example.expectedPosition);
  if (initial === null || expected === null)
    return fail('a simulation example has an invalid position');
  if (!Number.isSafeInteger(example.ticks) || example.ticks < 1)
    return fail('a simulation example must advance positive whole ticks');
  const engine = new FixedStepSimulation(initial, simulation.step, {
    ...simulation.timing,
    seed: example.seed,
  });
  for (const input of example.inputs) {
    const value = simulation.parseInput(input.value);
    if (value === null || !engine.enqueue({ ...input, value }).accepted)
      fail('a simulation example queues an invalid input');
  }
  engine.advanceTicks(example.ticks);
  if (
    simulation.codec.encode(engine.snapshot().state) !==
    simulation.codec.encode(expected)
  )
    fail(
      'a simulation example disagrees with its independent expected position'
    );
  return (
    simulation.result(initial) === null && simulation.result(expected) !== null
  );
}
