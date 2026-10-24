import type { SimulationContext } from '@pkgs/turn-game-shared-ts/simulation';
import type { PongConfig } from './pong-config';
import type { PongInput, PongSide, PongState } from './pong-state';

export type PongDifficulty = 'easy' | 'medium' | 'hard';
const LEVELS = {
  easy: { reactionMs: 260, error: 120, anticipation: 0 },
  medium: { reactionMs: 160, error: 56, anticipation: 0.65 },
  hard: { reactionMs: 80, error: 16, anticipation: 1 },
} as const;

/** Reflects an unfolded vertical trajectory through the court's two walls. */
function reflectedY(y: number, config: PongConfig): number {
  const span = config.height - config.ballRadius * 2;
  const wrapped =
    (((y - config.ballRadius) % (2 * span)) + 2 * span) % (2 * span);
  return config.ballRadius + (wrapped <= span ? wrapped : 2 * span - wrapped);
}

/** Delayed decisions and imperfect aiming; physical speed and input validation are unchanged. */
export function pongReactionTicks(
  config: PongConfig,
  difficulty: PongDifficulty
): number {
  return Math.max(
    1,
    Math.ceil((LEVELS[difficulty].reactionMs * config.tickRate) / 1000)
  );
}

export function pongBot(
  config: PongConfig,
  side: PongSide,
  difficulty: PongDifficulty
) {
  const level = LEVELS[difficulty];
  const reactionTicks = pongReactionTicks(config, difficulty);
  return (state: PongState, context: SimulationContext): PongInput => {
    // The current control is part of the serializable state, not a hidden bot timer.
    if ((context.tick - 1) % reactionTicks !== 0)
      return state.paddles[side].input;
    const toward = side === 'left' ? state.ball.vx < 0 : state.ball.vx > 0;
    const face =
      side === 'left' ? config.paddleInset : config.width - config.paddleInset;
    const time = toward
      ? Math.max(0, (face - state.ball.x) / state.ball.vx)
      : 0;
    const destination = toward
      ? reflectedY(
          state.ball.y + state.ball.vy * time * level.anticipation,
          config
        )
      : config.height / 2;
    const target = Math.max(
      0,
      Math.min(
        1,
        (destination + (context.random() * 2 - 1) * level.error) / config.height
      )
    );
    return { kind: 'target', target };
  };
}
