import { expect, test } from 'bun:test';
import { movePongBall } from '@libs/pong-shared-ts/pong-collisions';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const config = pongConfig();
const initial = initialPongState(config, () => 0);
const motion = { before: initial.paddles, after: initial.paddles };

test('swept paddle intersections reflect a ball that crosses the whole contact plane within one tick', () => {
  const face = config.paddleInset + config.paddleWidth / 2 + config.ballRadius;
  const ball = {
    x: face + 5,
    y: config.height / 2,
    vx: -config.maxBallSpeed,
    vy: 0,
  };
  const result = movePongBall(ball, config, motion, 1 / config.tickRate);
  expect(result.paddles).toBe(1);
  expect(result.scorer).toBeNull();
  expect(result.ball.x).toBeGreaterThan(face);
  expect(result.ball.vx).toBeGreaterThan(0);
  const next = movePongBall(result.ball, config, motion, 1 / config.tickRate);
  expect(next.paddles).toBe(0);
  expect(next.ball.x).toBeGreaterThan(result.ball.x);
});

test('a swept wall intersection consumes the remaining substep after reflecting its normal', () => {
  const result = movePongBall(
    { x: 600, y: 12, vx: 400, vy: -800 },
    config,
    motion,
    1 / 60
  );
  expect(result.walls).toBe(1);
  expect(result.ball.vy).toBe(800);
  expect(result.ball.y).toBeGreaterThan(config.ballRadius);
  expect(result.ball.x).toBeCloseTo(600 + 400 / 60, 10);
});

test('a missed paddle plane does not become a false collision when the ball is already behind it', () => {
  const ball = { x: config.paddleInset - 1, y: 400, vx: -1080, vy: 0 };
  const result = movePongBall(ball, config, motion, 1 / 60);
  expect(result.paddles).toBe(0);
  expect(result.ball.vx).toBe(-1080);
});

test('swept goal detection returns one scorer and never keeps integrating beyond the goal', () => {
  const result = movePongBall(
    { x: config.width + config.ballRadius - 1, y: 400, vx: 1080, vy: 0 },
    config,
    motion,
    1 / 60
  );
  expect(result.scorer).toBe('left');
  expect(result.ball.x).toBe(config.width + config.ballRadius);
  expect(result.paddles).toBe(0);
});

test('wall reflection preserves speed and keeps every nonscoring trajectory in the court', () => {
  assertProperty(
    'Pong wall geometry',
    fc.property(
      fc.integer({ min: 12, max: 788 }),
      fc.integer({ min: -1000, max: 1000 }),
      (y, vy) => {
        const result = movePongBall(
          { x: 600, y, vx: 0, vy },
          config,
          motion,
          1 / 60
        );
        expect(result.scorer).toBeNull();
        expect(result.ball.y).toBeGreaterThanOrEqual(config.ballRadius);
        expect(result.ball.y).toBeLessThanOrEqual(
          config.height - config.ballRadius
        );
        expect(Math.abs(result.ball.vy)).toBe(Math.abs(vy));
      }
    )
  );
});
