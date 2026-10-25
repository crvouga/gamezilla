import type { SimulationHarnessFixtures } from '@libs/game-session-harness-ts/simulation-fixtures';
import type {
  LightCyclesRiderCount,
  LightCyclesSeat,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type {
  LightCyclesRider,
  LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';

const WIDTH = 40;

function mark(trails: string, x: number, y: number, owner: number): string {
  const index = y * WIDTH + x;
  return trails.slice(0, index) + String(owner) + trails.slice(index + 1);
}

/**
 * Two independent examples per mode: a quick double turn queued during play
 * (one turn per step, never a reversal), and the decisive step of a game to
 * one round win, where every rider but Comet heads into the edge at once.
 */
export function lightCyclesSimulationFixtures(
  count: LightCyclesRiderCount
): SimulationHarnessFixtures {
  const codec = lightCyclesPositionCodec(count);
  const start = lightCyclesStart(count, 1);
  const seats = start.seats as readonly LightCyclesSeat[];
  const running: LightCyclesState = {
    ...start,
    phase: 'running',
    phaseTick: 1,
  };
  // Tick 2 is a step: Comet takes its first queued turn, everyone else rides straight.
  const stepped = running.riders.map((rider, index) =>
    index === 0
      ? {
          ...rider,
          y: rider.y - 1,
          heading: 'up' as const,
          turns: ['left' as const],
        }
      : moved(rider)
  );
  const turned: LightCyclesState = {
    ...running,
    phaseTick: 5,
    riders: stepped,
    trails: stepped.reduce(
      (trails, rider, index) => mark(trails, rider.x, rider.y, index),
      running.trails
    ),
  };
  const finalStep: LightCyclesState = {
    ...running,
    riders: running.riders.map((rider, index) =>
      index === 0
        ? rider
        : { ...rider, x: 39, y: 10 + 5 * index, heading: 'right' as const }
    ),
  };
  return {
    refusedInputs: [
      null,
      { round: 1 },
      { round: 0, heading: 'up' },
      { round: 1, heading: 'north' },
      { round: 1, heading: 'up', extra: true },
    ],
    examples: [
      {
        seed: `${count}-quick-turns`,
        initialPosition: codec.encode(running),
        ticks: 4,
        inputs: [
          {
            playerId: 'white',
            sequence: 1,
            tick: 1,
            value: { round: 1, heading: 'up' },
          },
          {
            playerId: 'white',
            sequence: 2,
            tick: 1,
            value: { round: 1, heading: 'down' },
          },
          {
            playerId: 'white',
            sequence: 3,
            tick: 2,
            value: { round: 1, heading: 'left' },
          },
        ],
        expectedPosition: codec.encode(turned),
      },
      decisive(codec, finalStep, seats),
    ],
  };
}

/** One step straight ahead for a rider that is not steered. */
function moved(rider: LightCyclesRider): LightCyclesRider {
  const dx = rider.heading === 'right' ? 1 : rider.heading === 'left' ? -1 : 0;
  const dy = rider.heading === 'down' ? 1 : rider.heading === 'up' ? -1 : 0;
  return { ...rider, x: rider.x + dx, y: rider.y + dy };
}

function decisive(
  codec: ReturnType<typeof lightCyclesPositionCodec>,
  state: LightCyclesState,
  seats: readonly LightCyclesSeat[]
): SimulationHarnessFixtures['examples'][number] {
  const cells = state.riders.reduce(
    (trails, rider, index) => mark(trails, rider.x, rider.y, index),
    '.'.repeat(WIDTH * 28)
  );
  const initial = { ...state, trails: cells, phaseTick: 2 };
  const comet = moved(state.riders[0]!);
  return {
    seed: `${seats.length}-decisive-step`,
    initialPosition: codec.encode(initial),
    ticks: 1,
    inputs: [],
    expectedPosition: codec.encode({
      ...initial,
      phase: 'completed',
      phaseTick: 0,
      trails: mark(cells, comet.x, comet.y, 0),
      riders: initial.riders.map((rider, index) =>
        index === 0 ? comet : { ...rider, alive: false }
      ),
      crashes: initial.riders.slice(1).map((rider) => ({
        seat: rider.seat,
        x: rider.x,
        y: rider.y,
        cause: 'wall' as const,
      })),
      roundWinner: 'white',
      scores: seats.map((_, index) => (index === 0 ? 1 : 0)),
      result: { winner: 'white', reason: 'target score' },
    }),
  };
}
