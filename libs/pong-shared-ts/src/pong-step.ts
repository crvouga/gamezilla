import type {
  SimulationContext,
  SimulationInput,
  SimulationStep,
} from '@pkgs/turn-game-shared-ts/simulation';
import { movePongBall } from './pong-collisions';
import type { PongConfig } from './pong-config';
import { advancePongPaddle } from './pong-paddle';
import {
  otherPongSide,
  PONG_NEUTRAL_INPUT,
  PONG_SIDES,
  type PongInput,
  type PongPaddle,
  type PongSide,
  type PongState,
} from './pong-state';

function movePaddle(
  paddle: PongPaddle,
  config: PongConfig,
  context: SimulationContext
): PongPaddle {
  const input =
    context.tick - paddle.inputTick > config.inputLeaseTicks
      ? PONG_NEUTRAL_INPUT
      : paddle.input;
  return advancePongPaddle(paddle, input, config, context.deltaMs);
}

function movePaddles(
  state: PongState,
  inputs: readonly SimulationInput<PongInput>[],
  config: PongConfig,
  context: SimulationContext
): PongState['paddles'] {
  const paddles = { ...state.paddles };
  for (const input of inputs) {
    if (input.playerId !== 'left' && input.playerId !== 'right')
      throw new Error('unknown Pong side');
    paddles[input.playerId] = {
      ...paddles[input.playerId],
      input: input.value,
      inputTick: context.tick,
    };
  }
  for (const side of PONG_SIDES)
    paddles[side] = movePaddle(paddles[side], config, context);
  return paddles;
}

function serve(
  state: PongState,
  config: PongConfig,
  context: SimulationContext
): PongState {
  const slope =
    (context.random() < 0.5 ? -1 : 1) * (0.2 + context.random() * 0.4);
  const horizontal = config.ballSpeed / Math.sqrt(1 + slope * slope);
  return {
    ...state,
    phase: 'playing',
    countdown: 0,
    ball: {
      x: config.width / 2,
      y: config.height / 2,
      vx: state.servingToward === 'left' ? -horizontal : horizontal,
      vy: horizontal * slope,
    },
    feedback: { ...state.feedback, serves: state.feedback.serves + 1 },
  };
}

function scorePoint(
  state: PongState,
  side: PongSide,
  config: PongConfig
): PongState {
  const score = { ...state.score, [side]: state.score[side] + 1 };
  const winner = score[side] >= state.targetScore ? side : null;
  return {
    ...state,
    score,
    winner,
    phase: winner === null ? 'countdown' : 'completed',
    countdown: winner === null ? config.serveTicks : 0,
    servingToward: otherPongSide(side),
    ball: { x: config.width / 2, y: config.height / 2, vx: 0, vy: 0 },
    feedback: { ...state.feedback, points: state.feedback.points + 1 },
  };
}

/** Pong owns only mechanics; the shared fixed-step engine owns time, input ordering and execution. */
export function createPongStep(
  config: PongConfig
): SimulationStep<PongState, PongInput> {
  return (state, inputs, context) => {
    if (state.phase === 'completed') return state;
    if (Math.abs(context.deltaMs - 1000 / config.tickRate) > 1e-9)
      throw new Error('Pong requires its configured fixed timestep');
    const paddles = movePaddles(state, inputs, config, context);
    if (state.phase === 'countdown') {
      const waiting = {
        ...state,
        paddles,
        countdown: Math.max(0, state.countdown - 1),
      };
      return waiting.countdown === 0
        ? serve(waiting, config, context)
        : waiting;
    }
    const motion = movePongBall(
      state.ball,
      config,
      { before: state.paddles, after: paddles },
      context.deltaMs / 1000
    );
    const updated = {
      ...state,
      paddles,
      ball: motion.ball,
      feedback: {
        ...state.feedback,
        walls: state.feedback.walls + motion.walls,
        paddles: state.feedback.paddles + motion.paddles,
      },
    };
    return motion.scorer === null
      ? updated
      : scorePoint(updated, motion.scorer, config);
  };
}
