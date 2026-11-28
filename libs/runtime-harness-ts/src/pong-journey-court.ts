import { readPongCourt } from '@libs/pong-harness-ts/pong-view';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, JOURNEY_WAIT_MS } from './journey-gestures';

const BOARD = 'multiplayer-board';
export type PongJourneySide = 'white' | 'black';
export type PongJourneyStart = {
  readonly gameId: string;
  readonly side: PongJourneySide;
  readonly targetScore: number;
  readonly score: Readonly<Record<'left' | 'right', number>>;
  readonly courtHeight: number;
};

export const pongJourneyCourt = (ui: Driver) => readPongCourt(ui, BOARD);

export async function pongJourneyStart(
  ui: Driver,
  expectedSide?: PongJourneySide
): Promise<PongJourneyStart> {
  const status = ui.get(`${BOARD}-status`);
  if (expectedSide !== undefined) {
    const paddle = expectedSide === 'white' ? 'Left' : 'Right';
    await ui
      .get('multiplayer-colour')
      .wait(
        { text: `play ${paddle}`, exact: false },
        { timeoutMs: JOURNEY_WAIT_MS }
      );
  }
  // One observation must see a playable announcement. A connected court can
  // enter its rally immediately, and a stale display still has seats and a score.
  await status.wait(
    { text: ['Serve in', 'Keep the ball in play.'], exact: false },
    { timeoutMs: JOURNEY_WAIT_MS }
  );
  const [gameId, side, court] = await Promise.all([
    ui.get('multiplayer-game').attribute('data-game-id'),
    ui.get('multiplayer-seat-near').attribute('data-side'),
    pongJourneyCourt(ui),
  ]);
  check(gameId !== null && gameId !== '', 'No matched Pong game is shown');
  check(
    side === 'white' || side === 'black',
    'No assigned Pong paddle is shown'
  );
  return {
    gameId,
    score: court.score,
    side,
    targetScore: court.targetScore,
    courtHeight: court.height,
  };
}

/** Keep an arrow held across simulation ticks, as a person does on the wide court. */
async function steerWithArrows(
  ui: Driver,
  side: PongJourneySide,
  targetY: number
): Promise<void> {
  const paddle = ui.get(
    `${BOARD}-${side === 'white' ? 'first' : 'second'}-paddle`
  );
  const [top, size] = await Promise.all([
    paddle.attribute('y'),
    paddle.attribute('height'),
  ]);
  const height = Number(size);
  check(top !== null && height > 0, 'No Pong paddle is shown');
  const distance = targetY - (Number(top) + height / 2);
  const court = ui.get(BOARD);
  if (Math.abs(distance) <= height / 4) {
    await court.key('arrowUp', 'keyup');
    await court.key('arrowDown', 'keyup');
  } else {
    await court.key(distance < 0 ? 'arrowDown' : 'arrowUp', 'keyup');
    await court.key(distance < 0 ? 'arrowUp' : 'arrowDown', 'keydown');
  }
}

/** Follow the ball or move away using the control this layout offers. */
export async function guidePongJourney(
  ui: Driver,
  side: PongJourneySide,
  following: boolean,
  courtHeight: number
): Promise<boolean> {
  const status = ui.get(`${BOARD}-status`);
  const finished = async () =>
    (await status.attribute('data-stage')) === 'finished';
  await status.expect.visible();
  if (await finished()) return true;
  const ball = await ui.get(`${BOARD}-ball`).attribute('data-ball-y');
  const y = Number(ball);
  check(ball !== null && Number.isFinite(y), 'No Pong ball is shown');
  const target = following
    ? Math.round((y / courtHeight) * 1000)
    : y < courtHeight / 2
      ? 1000
      : 0;
  try {
    const slider = ui.get(`${BOARD}-${side}-control`);
    if (await slider.isVisible()) {
      await slider.input(String(target));
    } else {
      await steerWithArrows(ui, side, (target / 1000) * courtHeight);
    }
  } catch (error) {
    // The point that ends the game can land between reading and moving.
    if (await finished()) return true;
    throw error;
  }
  return false;
}
