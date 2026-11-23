import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PongConfig } from './pong-config';
import { advancePongPaddle } from './pong-paddle';
import type { PongInput, PongState } from './pong-state';

/**
 * Where a ball bouncing between `low` and `high` is after travelling from
 * `from` to an unfolded `to`: reflections are folded back in.
 */
function fold(value: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return value;
  const period = 2 * span;
  const phase = (((value - low) % period) + period) % period;
  return low + (phase <= span ? phase : period - phase);
}

/**
 * `to` as it would be with `bounces` reflections between `low` and `high`
 * undone, travelling from a ball moving with `velocity`: the ball's path
 * between two courts is then a straight line.
 */
function unfold(
  to: number,
  bounces: number,
  velocity: number,
  low: number,
  high: number
): number {
  if (bounces <= 0) return to;
  const span = high - low;
  if (velocity >= 0)
    return bounces % 2 === 0
      ? to + bounces * span
      : 2 * high - to + (bounces - 1) * span;
  return bounces % 2 === 0
    ? to - bounces * span
    : 2 * low - to - (bounces - 1) * span;
}

/** Reflections an unfolded ball has passed on its way to `at`, at most `bounces`. */
function passed(
  at: number,
  bounces: number,
  velocity: number,
  low: number,
  high: number
): number {
  if (bounces <= 0) return 0;
  const span = high - low;
  const beyond = velocity >= 0 ? at - high : low - at;
  return beyond < 0 ? 0 : Math.min(bounces, Math.floor(beyond / span) + 1);
}

/** Motion along one axis between two courts: where, and how many reflections passed. */
function axis(
  from: { readonly at: number; readonly velocity: number },
  to: number,
  bounces: number,
  bounds: readonly [number, number],
  t: number
): { readonly at: number; readonly passed: number } {
  const [low, high] = bounds;
  const unfolded = from.at + (unfold(to, bounces, from.velocity, low, high) - from.at) * t;
  return {
    at: bounces === 0 ? unfolded : fold(unfolded, low, high),
    passed: passed(unfolded, bounces, from.velocity, low, high),
  };
}

/**
 * The court between two received courts of the same rally. The ball keeps
 * to its real path: a wall or paddle it bounced off between the two is
 * reached, not cut across, so a return is seen to touch the paddle.
 */
export function createPongInterpolation(config: PongConfig) {
  const face = config.paddleInset + config.paddleWidth / 2 + config.ballRadius;
  const left = face;
  const right = config.width - face;
  const top = config.ballRadius;
  const bottom = config.height - config.ballRadius;
  return (
    previous: PongState,
    current: PongState,
    fraction: number
  ): PongState => {
    const t = Math.max(0, Math.min(1, fraction));
    // A serve, a point or the end happens when playback reaches it: the
    // countdown or the scoring flight stays until then.
    if (
      previous.phase !== current.phase ||
      previous.feedback.points !== current.feedback.points ||
      previous.feedback.serves !== current.feedback.serves
    )
      return t < 1 ? previous : current;
    const blend = (a: number, b: number) => a + (b - a) * t;
    const paddles = current.feedback.paddles - previous.feedback.paddles;
    const walls = current.feedback.walls - previous.feedback.walls;
    const x = axis(
      { at: previous.ball.x, velocity: previous.ball.vx },
      current.ball.x,
      paddles,
      [left, right],
      t
    );
    // A paddle's return sets a new slope, so walls unfold only within one flight.
    const y =
      paddles === 0
        ? axis(
            { at: previous.ball.y, velocity: previous.ball.vy },
            current.ball.y,
            walls,
            [top, bottom],
            t
          )
        : { at: blend(previous.ball.y, current.ball.y), passed: t < 1 ? 0 : walls };
    // Until the ball reaches what it bounces off, it keeps its old heading,
    // and the bounce (and its sound) has not happened yet.
    const returned = x.passed >= paddles;
    const sign = (count: number) => (count % 2 === 0 ? 1 : -1);
    const ball = {
      x: x.at,
      y: y.at,
      vx: returned ? current.ball.vx : previous.ball.vx * sign(x.passed),
      vy:
        paddles === 0
          ? y.passed >= walls
            ? current.ball.vy
            : previous.ball.vy * sign(y.passed)
          : returned
            ? current.ball.vy
            : previous.ball.vy,
    };
    const feedback = {
      ...current.feedback,
      paddles: previous.feedback.paddles + x.passed,
      walls: paddles === 0 ? previous.feedback.walls + y.passed : t < 1 ? previous.feedback.walls : current.feedback.walls,
    };
    return {
      ...current,
      ball,
      feedback,
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
