import type { PongConfig } from './pong-config';
import type { PongBall, PongState } from './pong-state';

type Bounds = { readonly low: number; readonly high: number };

/** Where a ball bouncing between `low` and `high` is, from an unfolded position. */
function fold(value: number, bounds: Bounds): number {
  const span = bounds.high - bounds.low;
  if (span <= 0) return value;
  const period = 2 * span;
  const phase = (((value - bounds.low) % period) + period) % period;
  return bounds.low + (phase <= span ? phase : period - phase);
}

/** One axis of a flight between two courts, with `bounces` reflections on it. */
type Flight = {
  readonly from: number;
  readonly velocity: number;
  readonly to: number;
  readonly bounces: number;
  readonly bounds: Bounds;
};

/**
 * `flight.to` with its reflections undone, travelling from a ball moving
 * with `flight.velocity`: the path between two courts is then straight.
 */
function unfold(flight: Flight): number {
  const { to, bounces, velocity, bounds } = flight;
  if (bounces <= 0) return to;
  const span = bounds.high - bounds.low;
  if (velocity >= 0)
    return bounces % 2 === 0
      ? to + bounces * span
      : 2 * bounds.high - to + (bounces - 1) * span;
  return bounces % 2 === 0
    ? to - bounces * span
    : 2 * bounds.low - to - (bounces - 1) * span;
}

/** Reflections an unfolded ball has passed on its way to `at`, at most the flight's. */
function passed(flight: Flight, at: number): number {
  if (flight.bounces <= 0) return 0;
  const span = flight.bounds.high - flight.bounds.low;
  const beyond =
    flight.velocity >= 0 ? at - flight.bounds.high : flight.bounds.low - at;
  return beyond < 0
    ? 0
    : Math.min(flight.bounces, Math.floor(beyond / span) + 1);
}

/** Where the flight is at `t`, and how many of its reflections it has passed. */
function along(flight: Flight, t: number) {
  const unfolded = flight.from + (unfold(flight) - flight.from) * t;
  return {
    at: flight.bounces === 0 ? unfolded : fold(unfolded, flight.bounds),
    passed: passed(flight, unfolded),
  };
}

const sign = (count: number) => (count % 2 === 0 ? 1 : -1);

/**
 * The ball between two courts of one rally, and the bounces it has made by
 * then. Until it reaches what it bounces off, it keeps its old heading and
 * the bounce (and its sound) has not happened yet. A paddle's return sets a
 * new slope, so walls unfold only within one flight.
 */
function ballBetween(
  courts: { readonly previous: PongState; readonly current: PongState },
  t: number,
  surfaces: { readonly faces: Bounds; readonly edges: Bounds }
): {
  readonly ball: PongBall;
  readonly paddles: number;
  readonly walls: number;
} {
  const { previous, current } = courts;
  const paddles = current.feedback.paddles - previous.feedback.paddles;
  const walls = current.feedback.walls - previous.feedback.walls;
  const x = along(
    {
      from: previous.ball.x,
      velocity: previous.ball.vx,
      to: current.ball.x,
      bounces: paddles,
      bounds: surfaces.faces,
    },
    t
  );
  const returned = x.passed >= paddles;
  const y =
    paddles === 0
      ? along(
          {
            from: previous.ball.y,
            velocity: previous.ball.vy,
            to: current.ball.y,
            bounces: walls,
            bounds: surfaces.edges,
          },
          t
        )
      : {
          at: previous.ball.y + (current.ball.y - previous.ball.y) * t,
          passed: t < 1 ? 0 : walls,
        };
  const turned = paddles === 0 ? y.passed >= walls : returned;
  return {
    ball: {
      x: x.at,
      y: y.at,
      vx: returned ? current.ball.vx : previous.ball.vx * sign(x.passed),
      vy: turned
        ? current.ball.vy
        : previous.ball.vy * (paddles === 0 ? sign(y.passed) : 1),
    },
    paddles: x.passed,
    walls: y.passed,
  };
}

/**
 * The court between two received courts. The ball keeps to its real path:
 * a wall or paddle it bounced off between the two is reached, not cut
 * across, so a return is seen to touch the paddle. A serve, a point or the
 * end happens when playback reaches it.
 */
export function createPongInterpolation(config: PongConfig) {
  const face = config.paddleInset + config.paddleWidth / 2 + config.ballRadius;
  const surfaces = {
    faces: { low: face, high: config.width - face },
    edges: { low: config.ballRadius, high: config.height - config.ballRadius },
  };
  return (
    previous: PongState,
    current: PongState,
    fraction: number
  ): PongState => {
    const t = Math.max(0, Math.min(1, fraction));
    if (
      previous.phase !== current.phase ||
      previous.feedback.points !== current.feedback.points ||
      previous.feedback.serves !== current.feedback.serves
    )
      return t < 1 ? previous : current;
    const between = ballBetween({ previous, current }, t, surfaces);
    const blend = (a: number, b: number) => a + (b - a) * t;
    return {
      ...current,
      ball: between.ball,
      feedback: {
        ...current.feedback,
        paddles: previous.feedback.paddles + between.paddles,
        walls: previous.feedback.walls + between.walls,
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
  };
}
