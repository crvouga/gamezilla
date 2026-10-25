import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import fc from 'fast-check';
import type { GameLaw } from './game-rules-laws';
import { knownGamePositions, law, must } from './game-rules-laws';
import type { HarnessGame, SimulationHarnessGame } from './harness-game';
import {
  assertSimulationFixtures,
  type SimulationHarnessFixtures,
} from './simulation-fixtures';

type Example = SimulationHarnessFixtures['examples'][number];

function replay(
  simulation: RegisteredSimulation,
  example: Example,
  batch: number,
  paused: boolean
): void {
  const initial = simulation.codec.decode(example.initialPosition);
  must(initial !== null, 'an initial fixture position cannot be decoded');
  const before = simulation.codec.encode(initial);
  const engine = new FixedStepSimulation(initial, simulation.step, {
    ...simulation.timing,
    seed: example.seed,
  });
  for (const input of example.inputs) {
    const value = simulation.parseInput(input.value);
    must(
      value !== null && engine.enqueue({ ...input, value }).accepted,
      'a fixture input is refused'
    );
  }
  if (paused) {
    engine.setPaused(true);
    engine.advanceTicks(batch);
    must(
      engine.snapshot().tick === 0 &&
        simulation.codec.encode(engine.snapshot().state) === before,
      'paused execution changed its tick or position'
    );
    engine.setPaused(false);
  }
  const commandKey = simulation.commands?.key(initial);
  for (let left = example.ticks; left > 0; left -= batch) {
    engine.advanceTicks(Math.min(left, batch));
    must(
      simulation.commands?.key(engine.snapshot().state) === commandKey,
      'simulation steps changed the command-owned position'
    );
  }
  const expected = simulation.codec.decode(example.expectedPosition);
  must(expected !== null, 'an expected fixture position cannot be decoded');
  must(
    engine.snapshot().tick === example.ticks,
    'replay changed the number of logical ticks'
  );
  must(
    simulation.codec.encode(engine.snapshot().state) ===
      simulation.codec.encode(expected),
    'batched replay differs from the independent expected position'
  );
  must(
    simulation.codec.encode(initial) === before,
    'the simulation mutated its starting position'
  );
}

/** Each execution capability keeps its own fixture and fixed-step obligations, including hybrids. */
export function gameSimulationLaws(
  game: SimulationHarnessGame,
  others: readonly HarnessGame[]
): readonly GameLaw[] {
  const simulation = game.shared.registration.simulation;
  must(simulation !== undefined, 'simulation capability is missing');
  return [
    law(
      game,
      'every known simulated position belongs to this game alone',
      () => {
        const rules = game.shared.registration.rules;
        for (const position of knownGamePositions(game)) {
          must(
            rules.recognizes(position),
            'a known position is not recognized'
          );
          for (const other of others)
            must(
              !other.shared.registration.rules.recognizes(position),
              `${other.label} claims ${position}`
            );
        }
        for (const other of others)
          for (const position of knownGamePositions(other))
            must(
              !rules.recognizes(position),
              `it claims ${other.label}'s ${position}`
            );
      }
    ),
    law(game, 'its refused inputs and independent state examples hold', () => {
      assertSimulationFixtures(
        simulation!,
        game.simulationFixtures,
        (problem) => {
          throw new Error(problem);
        }
      );
    }),
    law(
      game,
      'tick batching and pauses preserve every independently authored result',
      () => {
        assertProperty(
          `${game.label}: fixed-step examples`,
          fc.property(
            fc.constantFrom(...game.simulationFixtures.examples),
            fc.integer({ min: 1, max: simulation!.timing.maxCatchUpTicks }),
            fc.boolean(),
            (example, batch, paused) =>
              replay(simulation!, example, batch, paused)
          )
        );
      }
    ),
    law(
      game,
      'its position codec preserves every fixture and its game namespace',
      () => {
        for (const example of game.simulationFixtures.examples) {
          for (const position of [
            example.initialPosition,
            example.expectedPosition,
          ]) {
            const decoded = simulation!.codec.decode(position);
            must(decoded !== null, 'a fixture does not decode');
            const encoded = simulation!.codec.encode(decoded);
            must(
              game.shared.registration.rules.recognizes(encoded),
              'a simulated position is not recognized by its game'
            );
            const restored = simulation!.codec.decode(encoded);
            must(
              restored !== null &&
                simulation!.codec.encode(restored) === encoded,
              'the position codec changes on a second round trip'
            );
          }
        }
      }
    ),
  ];
}
