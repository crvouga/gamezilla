import type { PongConfig } from './pong-config';
import type { PongInput, PongPaddle } from './pong-state';

/** The same physical displacement bound applies to authoritative and predicted local movement. */
export function advancePongPaddle(
  paddle: PongPaddle,
  input: PongInput,
  config: PongConfig,
  deltaMs: number
): PongPaddle {
  const maximum = (config.paddleSpeed * deltaMs) / 1000;
  const delta =
    input.kind === 'direction'
      ? input.direction * maximum
      : Math.max(
          -maximum,
          Math.min(maximum, input.target * config.height - paddle.y)
        );
  const y = Math.max(
    config.paddleHeight / 2,
    Math.min(config.height - config.paddleHeight / 2, paddle.y + delta)
  );
  return { ...paddle, y, input };
}
