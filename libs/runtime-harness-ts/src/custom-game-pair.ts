import {
  acceptBlack,
  becomeReady,
  expectBlackSeated,
  expectOwnSeat,
  inviteToBlack,
} from './custom-game-journey';
import type { JourneyHost } from './journey-types';

export async function prepareCustomGamePair(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>
): Promise<void> {
  await host.act('inviteToBlack', inviteToBlack);
  await host.actAsGuest('acceptBlack', acceptBlack);
  await host.actAsGuest('expectOwnSeat', expectOwnSeat);
  // Acceptance changes the choices revision. The host must see that accepted
  // seat before submitting readiness against its local copy of those choices.
  await host.act('expectBlackSeated', expectBlackSeated);
  await host.act('becomeReady', becomeReady);
  await host.actAsGuest('becomeReady', becomeReady);
}
