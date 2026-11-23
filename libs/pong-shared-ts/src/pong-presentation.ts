import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PongConfig } from './pong-config';
import { advancePongPaddle } from './pong-paddle';
import type { PongInput, PongState } from './pong-state';

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

/** Compare only the controlled paddle across an uninterrupted point and phase. */
export function createPongPredictionError(config: PongConfig) {
  return (
    predicted: PongState,
    authoritative: PongState,
    side: GameSide
  ): number | null => {
    if (
      predicted.phase !== authoritative.phase ||
      predicted.feedback.points !== authoritative.feedback.points
    )
      return null;
    const paddle = side === 'white' ? 'left' : 'right';
    return (
      Math.abs(predicted.paddles[paddle].y - authoritative.paddles[paddle].y) /
      config.height
    );
  };
}
