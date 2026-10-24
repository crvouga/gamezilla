import type { PongConfig } from './pong-config';
import type { PongBall, PongPaddle, PongSide } from './pong-state';

type Collision = {
  readonly after: number;
  readonly kind: 'wall' | 'paddle' | 'point';
  readonly side: PongSide;
};
export type PongMotion = {
  readonly ball: PongBall;
  readonly scorer: PongSide | null;
  readonly walls: number;
  readonly paddles: number;
};
type PaddleMotion = {
  readonly before: Readonly<Record<PongSide, PongPaddle>>;
  readonly after: Readonly<Record<PongSide, PongPaddle>>;
};

function upcomingCollision(
  ball: PongBall,
  config: PongConfig,
  motion: PaddleMotion,
  timing: { elapsed: number; remaining: number; seconds: number }
): Collision | null {
  const candidates: Collision[] = [];
  if (ball.vy !== 0) {
    const wall =
      ball.vy < 0 ? config.ballRadius : config.height - config.ballRadius;
    candidates.push({
      after: (wall - ball.y) / ball.vy,
      kind: 'wall',
      side: 'left',
    });
  }
  if (ball.vx !== 0) {
    const side = ball.vx < 0 ? 'left' : 'right';
    const sign = side === 'left' ? 1 : -1;
    const center =
      side === 'left' ? config.paddleInset : config.width - config.paddleInset;
    const face = center + sign * (config.paddleWidth / 2 + config.ballRadius);
    const after = (face - ball.x) / ball.vx;
    const progress = Math.min(1, (timing.elapsed + after) / timing.seconds);
    const y =
      motion.before[side].y +
      (motion.after[side].y - motion.before[side].y) * progress;
    if (
      Math.abs(ball.y + ball.vy * after - y) <=
      config.paddleHeight / 2 + config.ballRadius
    )
      candidates.push({ after, kind: 'paddle', side });
    const goal =
      side === 'left' ? -config.ballRadius : config.width + config.ballRadius;
    candidates.push({
      after: (goal - ball.x) / ball.vx,
      kind: 'point',
      side: side === 'left' ? 'right' : 'left',
    });
  }
  return (
    candidates
      .filter(
        (collision) =>
          collision.after >= 0 && collision.after <= timing.remaining
      )
      .sort((a, b) => a.after - b.after)[0] ?? null
  );
}

function bounceFromPaddle(
  ball: PongBall,
  collision: Collision,
  config: PongConfig,
  paddleY: number
): PongBall {
  const offset = Math.max(
    -1,
    Math.min(1, (ball.y - paddleY) / (config.paddleHeight / 2))
  );
  const slope = offset * config.maxBounceSlope;
  const speed = Math.min(
    config.maxBallSpeed,
    Math.hypot(ball.vx, ball.vy) + config.hitAcceleration
  );
  const horizontal = speed / Math.sqrt(1 + slope * slope);
  return {
    ...ball,
    vx: collision.side === 'left' ? horizontal : -horizontal,
    vy: horizontal * slope,
  };
}

/** Swept AABB for the square ball; tests every crossed surface, including at the speed cap. */
export function movePongBall(
  ball: PongBall,
  config: PongConfig,
  motion: PaddleMotion,
  seconds: number
): PongMotion {
  let current = ball;
  let remaining = seconds;
  let walls = 0;
  let paddles = 0;
  for (
    let count = 0;
    count < config.maxCollisionsPerTick && remaining > 0;
    count++
  ) {
    const collision = upcomingCollision(current, config, motion, {
      elapsed: seconds - remaining,
      remaining,
      seconds,
    });
    const travel = collision?.after ?? remaining;
    current = {
      ...current,
      x: current.x + current.vx * travel,
      y: current.y + current.vy * travel,
    };
    remaining -= travel;
    if (collision === null) break;
    if (collision.kind === 'point')
      return { ball: current, scorer: collision.side, walls, paddles };
    if (collision.kind === 'wall') {
      current = {
        ...current,
        y:
          current.vy < 0
            ? config.ballRadius
            : config.height - config.ballRadius,
        vy: -current.vy,
      };
      walls++;
    } else {
      const side = collision.side;
      const progress = (seconds - remaining) / seconds;
      const paddleY =
        motion.before[side].y +
        (motion.after[side].y - motion.before[side].y) * progress;
      current = bounceFromPaddle(current, collision, config, paddleY);
      paddles++;
    }
  }
  // Exhausting the safety bound holds at the last collision; it never tunnels.
  return { ball: current, scorer: null, walls, paddles };
}
