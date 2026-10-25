import type { SimulationHarnessFixtures } from '@libs/game-session-harness-ts/simulation-fixtures';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';

/** Literal court examples: ten units per tick at 600 units per second, and one decisive goal. */
const opening: PongState = {
  targetScore: 1,
  phase: 'countdown',
  countdown: 180,
  servingToward: 'right',
  paddles: {
    left: { y: 400, input: { kind: 'direction', direction: 0 }, inputTick: 0 },
    right: { y: 400, input: { kind: 'direction', direction: 0 }, inputTick: 0 },
  },
  ball: { x: 600, y: 400, vx: 0, vy: 0 },
  score: { left: 0, right: 0 },
  winner: null,
  feedback: { walls: 0, paddles: 0, points: 0, serves: 0 },
};
const beforeGoal: PongState = {
  ...opening,
  phase: 'playing',
  countdown: 0,
  ball: { x: 1208, y: 100, vx: 480, vy: 0 },
  feedback: { walls: 0, paddles: 0, points: 0, serves: 1 },
};
export const PONG_SIMULATION_FIXTURES: SimulationHarnessFixtures = {
  refusedInputs: [
    null,
    { kind: 'direction', direction: 2 },
    { kind: 'target', target: -1 },
  ],
  examples: [
    {
      seed: 'held-paddles-eight-ticks',
      initialPosition: pongPositionCodec.encode(opening),
      ticks: 8,
      inputs: [
        {
          playerId: 'white',
          sequence: 1,
          tick: 1,
          value: { kind: 'direction', direction: -1 },
        },
        {
          playerId: 'black',
          sequence: 1,
          tick: 1,
          value: { kind: 'direction', direction: 1 },
        },
      ],
      expectedPosition: pongPositionCodec.encode({
        ...opening,
        countdown: 172,
        paddles: {
          left: {
            y: 320,
            input: { kind: 'direction', direction: -1 },
            inputTick: 1,
          },
          right: {
            y: 480,
            input: { kind: 'direction', direction: 1 },
            inputTick: 1,
          },
        },
      }),
    },
    {
      seed: 'paddle-example',
      initialPosition: pongPositionCodec.encode(opening),
      ticks: 1,
      inputs: [
        {
          playerId: 'white',
          sequence: 1,
          tick: 1,
          value: { kind: 'direction', direction: -1 },
        },
      ],
      expectedPosition: pongPositionCodec.encode({
        ...opening,
        countdown: 179,
        paddles: {
          ...opening.paddles,
          left: {
            y: 390,
            input: { kind: 'direction', direction: -1 },
            inputTick: 1,
          },
        },
      }),
    },
    {
      seed: 'decisive-point',
      initialPosition: pongPositionCodec.encode(beforeGoal),
      ticks: 1,
      inputs: [],
      expectedPosition: pongPositionCodec.encode({
        ...opening,
        phase: 'completed',
        countdown: 0,
        score: { left: 1, right: 0 },
        winner: 'left',
        feedback: { walls: 0, paddles: 0, points: 1, serves: 1 },
      }),
    },
  ],
};
