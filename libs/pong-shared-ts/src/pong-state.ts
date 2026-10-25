import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { z } from 'zod';
import type { PongConfig } from './pong-config';

export const PONG_SIDES = ['left', 'right'] as const;
export type PongSide = (typeof PONG_SIDES)[number];

const inputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('direction'),
      direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    })
    .strict(),
  z
    .object({ kind: z.literal('target'), target: z.number().min(0).max(1) })
    .strict(),
]);

export type PongInput = z.infer<typeof inputSchema>;
export const PONG_NEUTRAL_INPUT: PongInput = Object.freeze({
  kind: 'direction',
  direction: 0,
});

export function parsePongInput(value: unknown): PongInput | null {
  const parsed = inputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type PongPaddle = {
  readonly y: number;
  readonly input: PongInput;
  readonly inputTick: number;
};

export type PongBall = {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
};
export type PongState = {
  readonly targetScore: number;
  readonly phase: 'countdown' | 'playing' | 'completed';
  readonly countdown: number;
  readonly servingToward: PongSide;
  readonly paddles: Readonly<Record<PongSide, PongPaddle>>;
  readonly ball: PongBall;
  readonly score: Readonly<Record<PongSide, number>>;
  readonly winner: PongSide | null;
  /** Monotonic feedback counters survive snapshots sent less often than ticks. */
  readonly feedback: {
    readonly walls: number;
    readonly paddles: number;
    readonly points: number;
    readonly serves: number;
  };
};

export function initialPongState(
  config: PongConfig,
  random: Random
): PongState {
  const paddle = (): PongPaddle => ({
    y: config.height / 2,
    input: PONG_NEUTRAL_INPUT,
    inputTick: 0,
  });
  return {
    targetScore: config.targetScore,
    phase: 'countdown',
    countdown: config.countdownTicks,
    servingToward: random() < 0.5 ? 'left' : 'right',
    paddles: { left: paddle(), right: paddle() },
    ball: { x: config.width / 2, y: config.height / 2, vx: 0, vy: 0 },
    score: { left: 0, right: 0 },
    winner: null,
    feedback: { walls: 0, paddles: 0, points: 0, serves: 0 },
  };
}

export function otherPongSide(side: PongSide): PongSide {
  return side === 'left' ? 'right' : 'left';
}
