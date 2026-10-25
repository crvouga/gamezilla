import type { PongPaddle, readPongCourt } from './pong-view';

type Court = Awaited<ReturnType<typeof readPongCourt>>;

/** Estimate the landing from consecutive visible positions, including wall reflections. */
function landing(court: Court, previous: Court['ball'], side: PongPaddle) {
  const dx = court.ball.x - previous.x;
  const distance = court.faces[side] - court.ball.x;
  if (dx === 0 || distance / dx < 0) return court.ball.y;
  const y = court.ball.y + ((court.ball.y - previous.y) * distance) / dx;
  const span = court.height - 2 * court.radius;
  const folded = (((y - court.radius) % (2 * span)) + 2 * span) % (2 * span);
  return court.radius + Math.min(folded, 2 * span - folded);
}

/** Actual sliders enact this strategy; only the model decides whether the point was correct. */
export function pongGuidance(
  court: Court,
  previous: Court['ball'],
  winner: PongPaddle
): Readonly<Record<PongPaddle, number>> {
  const target = (side: PongPaddle) => {
    const y = landing(court, previous, side);
    return side === winner
      ? Math.round((y / court.height) * 1000)
      : y < court.height / 2
        ? 1000
        : 0;
  };
  return { left: target('left'), right: target('right') };
}
