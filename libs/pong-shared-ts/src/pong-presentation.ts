import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PongConfig } from './pong-config';
import { advancePongPaddle } from './pong-paddle';
import type { PongInput, PongState } from './pong-state';

export function interpolatePong(
  previous: PongState,
  current: PongState,
  fraction: number
): PongState {
  if (
    previous.phase !== current.phase ||
    previous.feedback.points !== current.feedback.points
  )
    return current;
  const t = Math.max(0, Math.min(1, fraction));
  const blend = (a: number, b: number) => a + (b - a) * t;
  return {
    ...current,
    ball: {
      ...current.ball,
      x: blend(previous.ball.x, current.ball.x),
      y: blend(previous.ball.y, current.ball.y),
    },
    paddles: {
      left: {
        ...current.paddles.left,
        y: blend(previous.paddles.left.y, current.paddles.left.y),
      },
      right: {
        ...current.paddles.right,
        y: blend(previous.paddles.right.y, current.paddles.right.y),
      },
    },
  };
}

export function createPongPrediction(config: PongConfig) {
  return (
    state: PongState,
    side: GameSide,
    input: PongInput,
    deltaMs: number
  ): PongState => {
    if (state.phase === 'completed') return state;
    const paddle = side === 'white' ? 'left' : 'right';
    return {
      ...state,
      paddles: {
        ...state.paddles,
        [paddle]: advancePongPaddle(
          state.paddles[paddle],
          input,
          config,
          deltaMs
        ),
      },
    };
  };
}
