import { readPongCourt } from '@libs/pong-harness-ts/pong-view';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, JOURNEY_WAIT_MS } from './journey-gestures';

const BOARD = 'multiplayer-board';
export type PongJourneySide = 'white' | 'black';
export type PongJourneyStart = {
  readonly gameId: string;
  readonly side: PongJourneySide;
  readonly targetScore: number;
};

export const pongJourneyCourt = (ui: Driver) => readPongCourt(ui, BOARD);

export async function pongJourneyStart(ui: Driver): Promise<PongJourneyStart> {
  await ui
    .get(`${BOARD}-status`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const gameId = await ui.get('multiplayer-game').attribute('data-game-id');
  check(gameId !== null && gameId !== '', 'No matched Pong game is shown');
  const side = (await ui.get(`${BOARD}-white-control`).isVisible())
    ? 'white'
    : 'black';
  await ui.get(`${BOARD}-${side}-control`).wait('enabled', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
  return {
    gameId,
    side,
    targetScore: (await pongJourneyCourt(ui)).targetScore,
  };
}

/** Follow the visible ball or move away, through the actual assigned slider. */
export async function guidePongJourney(
  ui: Driver,
  side: PongJourneySide,
  following: boolean
): Promise<boolean> {
  const court = await pongJourneyCourt(ui);
  if (court.stage === 'finished') return true;
  const target = following
    ? Math.round((court.ball.y / court.height) * 1000)
    : court.ball.y < court.height / 2
      ? 1000
      : 0;
  await ui.get(`${BOARD}-${side}-control`).input(String(target));
  return false;
}
