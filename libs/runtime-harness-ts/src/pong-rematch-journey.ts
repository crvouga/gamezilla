import { check, tap } from './journey-gestures';
import { type JourneyHost, journeyDevice } from './journey-types';
import {
  type PongJourneyStart,
  pongJourneyCourt,
  pongJourneyStart,
} from './pong-journey-court';

export async function offerPongRematch(
  host: JourneyHost,
  actor: string
): Promise<void> {
  await journeyDevice(host, actor)('offerPongRematch', (ui) =>
    tap(ui, 'multiplayer-offer-rematch')
  );
}

export async function acceptPongRematch(
  host: JourneyHost,
  actor: string
): Promise<void> {
  await journeyDevice(host, actor)('acceptPongRematch', (ui) =>
    tap(ui, 'multiplayer-accept-rematch')
  );
}

export async function observePongRematch(
  host: JourneyHost,
  start: PongJourneyStart
): Promise<void> {
  let rematchId = '';
  await host.act('observePongRematch', async (ui) => {
    const next = await pongJourneyStart(ui);
    const court = await pongJourneyCourt(ui);
    check(next.gameId !== start.gameId, 'The rematch reused the finished game');
    check(next.side !== start.side, 'Alice kept her earlier paddle');
    check(
      court.score.left === 0 && court.score.right === 0,
      'The rematch kept old points'
    );
    check(
      court.stage === 'countdown' || court.stage === 'playing',
      'The rematch did not start'
    );
    rematchId = next.gameId;
  });
  await host.actAsGuest('observePongRematch', async (ui) => {
    const next = await pongJourneyStart(ui);
    const court = await pongJourneyCourt(ui);
    check(next.gameId === rematchId, 'The people see different rematches');
    check(next.side === start.side, 'Bob kept his earlier paddle');
    check(
      court.score.left === 0 && court.score.right === 0,
      'Bob sees the earlier score'
    );
  });
}

export async function observePongTarget(
  host: JourneyHost,
  target: number
): Promise<void> {
  for (const act of [host.act, host.actAsGuest]) {
    await act('observePongTarget', async (ui) => {
      check(
        (await pongJourneyCourt(ui)).targetScore === target,
        'The rematch changed its target score'
      );
    });
  }
}
