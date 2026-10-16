import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import {
  check,
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { expectSharedMultiplayerGame } from './multiplayer-journey';
import { retirePreviousMultiplayer } from './multiplayer-search-recovery';

async function search(ui: Driver): Promise<void> {
  await hostSpace(ui);
  await tap(ui, 'game-menu-connect-four');
  await tap(ui, 'connect-four-multiplayer');
  await retirePreviousMultiplayer(ui);
  await tap(ui, 'multiplayer-time-control-5-0');
  await tap(ui, 'multiplayer-find');
}
async function firstSide(ui: Driver): Promise<boolean> {
  await ui
    .get('multiplayer-colour')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  return ((await ui.get('multiplayer-colour').text()) ?? '').includes('Red');
}
export async function dropConnectFourDisc(
  ui: Driver,
  column: number,
  ply: number
): Promise<void> {
  if (ply > 1)
    await ui
      .get(`multiplayer-move-${ply - 1}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get(`connect-four-column-${column + 1}`)
    .wait('enabled', { timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get(`connect-four-column-${column + 1}`)
    .tap({ timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get(`multiplayer-move-${ply}`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}
/** Real controls and real pairing, with no answer probes or test-only commands. */
export async function playConnectFourJourney(
  host: JourneyHost
): Promise<boolean> {
  await host.open('signed-in');
  await host.openPeer('signed-in');
  host.defer('connect-four-host-space', endActiveSpace);
  host.defer('connect-four-peer-space', () =>
    host.actAsGuest('endPeerSpace', endActiveSpace)
  );
  await host.act('findConnectFourOpponent', search);
  await host.actAsGuest('findConnectFourOpponent', search);
  await expectSharedMultiplayerGame(host, JOURNEY_WAIT_MS);
  let first = false;
  await host.act('readConnectFourSide', async (ui) => {
    first = await firstSide(ui);
  });
  const red = first ? host.act : host.actAsGuest;
  const yellow = first ? host.actAsGuest : host.act;
  for (let ply = 1; ply <= 7; ply++)
    await (ply % 2 === 1 ? red : yellow)('dropConnectFourDisc', (ui) =>
      dropConnectFourDisc(ui, ply % 2 === 1 ? 0 : 1, ply)
    );
  return first;
}
export async function observeConnectFourJourney(
  host: JourneyHost,
  first: boolean
): Promise<void> {
  const red = first ? host.act : host.actAsGuest;
  const yellow = first ? host.actAsGuest : host.act;
  await red('observeConnectFourVictory', async (ui) => {
    await ui
      .get('multiplayer-announcement')
      .expect.text('You won the multiplayer game.', {
        exact: false,
        timeoutMs: JOURNEY_WAIT_MS,
      });
    const cells = JSON.parse(
      (await ui.get('connect-four-board').attribute('data-cells')) ?? '[]'
    ) as number[];
    check(
      cells.filter(Boolean).length === 7,
      'The completed board lost a disc'
    );
  });
  await yellow('observeConnectFourDefeat', (ui) =>
    ui
      .get('multiplayer-announcement')
      .expect.text('Your opponent won the multiplayer game.', {
        exact: false,
        timeoutMs: JOURNEY_WAIT_MS,
      })
  );
}
