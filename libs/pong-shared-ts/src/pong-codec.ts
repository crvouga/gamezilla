import type { SimulationCodec } from '@pkgs/turn-game-shared-ts/simulation';
import { z } from 'zod';
import type { PongConfig } from './pong-config';
import { type PongState, parsePongInput } from './pong-state';

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

function validPhase(state: PongState, config: PongConfig): boolean {
  if (state.feedback.points !== state.score.left + state.score.right)
    return false;
  if (state.feedback.serves > state.feedback.points + 1) return false;
  const underTarget =
    state.score.left < state.targetScore &&
    state.score.right < state.targetScore;
  if (state.phase === 'playing')
    return (
      underTarget &&
      state.winner === null &&
      state.countdown === 0 &&
      Math.hypot(state.ball.vx, state.ball.vy) >= config.ballSpeed - 1e-8
    );
  const centered =
    state.ball.x === config.width / 2 &&
    state.ball.y === config.height / 2 &&
    state.ball.vx === 0 &&
    state.ball.vy === 0;
  if (!centered) return false;
  if (state.phase === 'countdown')
    return underTarget && state.winner === null && state.countdown > 0;
  return (
    state.winner !== null &&
    state.countdown === 0 &&
    state.score[state.winner] === state.targetScore &&
    state.score[state.winner === 'left' ? 'right' : 'left'] < state.targetScore
  );
}

/** One canonical validated state representation for checkpoints and live snapshots. */
export function pongCodec(config: PongConfig): SimulationCodec<PongState> {
  const paddle = z
    .object({
      y: z
        .number()
        .min(config.paddleHeight / 2)
        .max(config.height - config.paddleHeight / 2),
      input: z.custom<PongState['paddles']['left']['input']>(
        (value) => parsePongInput(value) !== null
      ),
      inputTick: integer,
    })
    .strict();
  const schema = z
    .object({
      targetScore: integer.min(1).max(99),
      phase: z.enum(['countdown', 'playing', 'completed']),
      countdown: integer.max(config.countdownTicks),
      servingToward: z.enum(['left', 'right']),
      paddles: z.object({ left: paddle, right: paddle }).strict(),
      ball: z
        .object({
          x: z
            .number()
            .min(-config.ballRadius)
            .max(config.width + config.ballRadius),
          y: z
            .number()
            .min(config.ballRadius)
            .max(config.height - config.ballRadius),
          vx: z.number(),
          vy: z.number(),
        })
        .strict(),
      score: z
        .object({
          left: integer.max(99),
          right: integer.max(99),
        })
        .strict(),
      winner: z.enum(['left', 'right']).nullable(),
      feedback: z
        .object({
          walls: integer,
          paddles: integer,
          points: integer,
          serves: integer,
        })
        .strict(),
    })
    .strict()
    .refine(
      (state) =>
        validPhase(state, config) &&
        Math.hypot(state.ball.vx, state.ball.vy) <= config.maxBallSpeed + 1e-8
    );
  return {
    encode: (state) => JSON.stringify(schema.parse(state)),
    decode: (encoded) => {
      try {
        const parsed = schema.safeParse(JSON.parse(encoded));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}
