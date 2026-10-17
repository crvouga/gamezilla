import type { PlayableGame } from '@libs/game-session-harness/harness-game';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { check, hostSpace, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import {
  expectMultiplayerLoss,
  expectMultiplayerWin,
  expectSharedMultiplayerGame,
} from './multiplayer-journey';
import {
  endMultiplayerSpace,
  retirePreviousMultiplayer,
} from './multiplayer-search-recovery';
import { chooseMultiplayerTimeControl } from './multiplayer-time-control-gesture';

/** Host a space, pick `game` and find an opponent at 5+0, with real controls. */
function findOpponent(game: PlayableGame): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await hostSpace(ui);
    await tap(ui, Handles.gameMenu(game.shared.id));
    await tap(ui, Handles.gameChoice('multiplayer'));
    await retirePreviousMultiplayer(ui);
    await chooseMultiplayerTimeControl(ui, '5+0');
    await tap(ui, 'multiplayer-find');
  };
}

/** Whether this device plays the first side: it may move before anyone has. */
async function playsFirst(ui: Driver): Promise<boolean> {
  await ui
    .get('multiplayer-colour')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  return (
    (await ui.get('multiplayer-game').attribute('data-can-move')) === 'true'
  );
}

/**
 * Make the `ply`-th move of a matched game on its board, once the
 * opponent's previous move has arrived, and wait for it to be accepted.
 */
export async function playJourneyMove(
  ui: Driver,
  game: PlayableGame,
  action: string,
  ply: number
): Promise<void> {
  if (ply > 1)
    await ui
      .get(`multiplayer-move-${ply - 1}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await game.shared.automation.perform(ui, Handles.multiplayerBoard, action);
  await ui
    .get(`multiplayer-move-${ply}`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/** Two people find each other for `game` and play its victory to the end. */
export async function playGameJourney(
  host: JourneyHost,
  game: PlayableGame
): Promise<boolean> {
  const id = game.shared.id;
  await host.open('signed-in');
  await host.openPeer('signed-in');
  host.defer(`${id}-host-space`, endMultiplayerSpace);
  host.defer(`${id}-peer-space`, () =>
    host.actAsGuest('endPeerSpace', endMultiplayerSpace)
  );
  await host.act('findGameOpponent', findOpponent(game));
  await host.actAsGuest('findGameOpponent', findOpponent(game));
  await expectSharedMultiplayerGame(host, JOURNEY_WAIT_MS);
  let first = false;
  await host.act('readGameSide', async (ui) => {
    first = await playsFirst(ui);
  });
  const [mover, opponent] = first
    ? [host.act, host.actAsGuest]
    : [host.actAsGuest, host.act];
  for (const [index, action] of game.fixtures.firstSideVictory.entries())
    await (index % 2 === 0 ? mover : opponent)('playJourneyMove', (ui) =>
      playJourneyMove(ui, game, action, index + 1)
    );
  return first;
}

/** Both people see the same finished game: one won, the other lost. */
export async function observeGameJourney(
  host: JourneyHost,
  game: PlayableGame,
  first: boolean
): Promise<void> {
  const [winner, loser] = first
    ? [host.act, host.actAsGuest]
    : [host.actAsGuest, host.act];
  const rules = game.shared.turnGame.rules;
  const finished = rules.replay(
    game.fixtures.firstSideVictory,
    game.fixtures.firstSideVictory.length
  );
  await winner('observeGameVictory', async (ui) => {
    await expectMultiplayerWin(ui);
    check(
      (await ui.get('multiplayer-game').attribute('data-fen')) === finished,
      'The finished game lost a move'
    );
  });
  await loser('observeGameDefeat', expectMultiplayerLoss);
}
