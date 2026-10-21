import {
  acceptBlack,
  becomeReady,
  expectBlackNamed,
  inviteToBlack,
  readOwnBlackName,
} from './custom-game-journey';
import type { JourneyHost } from './journey-types';

export async function prepareCustomGamePair(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>
): Promise<void> {
  await host.act('inviteToBlack', inviteToBlack);
  await host.actAsGuest('acceptBlack', acceptBlack);
  let name = '';
  await host.actAsGuest('readOwnBlackName', async (ui) => {
    name = await readOwnBlackName(ui);
  });
  // Acceptance changes the choices revision. The host must see that accepted
  // seat before submitting readiness against its local copy of those choices.
  await host.act('expectBlackNamed', expectBlackNamed(name));
  await host.act('becomeReady', becomeReady);
  await host.actAsGuest('becomeReady', becomeReady);
}
