import {
  type GameLesson,
  practiceBoard,
} from '@libs/game-menu-client-ts/game-lesson';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  parsePongInput,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import { t } from '@lingui/core/macro';
import { PongBoard } from './pong-board';

const config = pongConfig();
const step = createPongStep(config);
const Board = practiceBoard(PongBoard, {
  simulationInput: (value) => {
    const input = parsePongInput(value);
    return input === null ||
      (input.kind === 'direction' && input.direction === 0)
      ? null
      : JSON.stringify(input);
  },
});

function incoming(y: number) {
  return pongPositionCodec.encode({
    ...initialPongState(config, () => 0),
    phase: 'playing',
    countdown: 0,
    ball: { x: 160, y, vx: -480, vy: 0 },
  });
}

/** Let the real ball reach the paddle after each steering gesture. */
function returnBall(position: string, action: string) {
  let court = pongPositionCodec.decode(position);
  const input = parsePongInput(JSON.parse(action));
  if (!court || !input) return null;
  const deltaMs = 1000 / config.tickRate;
  for (let tick = 1; tick <= 24; tick++) {
    court = step(
      court,
      [{ playerId: 'left', tick, sequence: tick, value: input }],
      { tick, deltaMs, elapsedMs: tick * deltaMs, random: () => 0 }
    );
    if (court.feedback.paddles > 0) return pongPositionCodec.encode(court);
    if (court.phase !== 'playing') break;
  }
  return null;
}

export const pongLesson: GameLesson = [
  {
    Board,
    initial: () => incoming(290),
    play: returnBall,
    prompt: () =>
      t`Return the high ball. Steer the left paddle up with the Up arrow or drag up on the court.`,
    success: () => t`Your paddle sent the ball back across the court.`,
  },
  {
    Board,
    initial: () => incoming(510),
    play: returnBall,
    prompt: () =>
      t`This ball is coming in low. Steer the left paddle down to meet it.`,
    success: () =>
      t`Another return. A ball that passes the opposing paddle scores a point.`,
  },
];
