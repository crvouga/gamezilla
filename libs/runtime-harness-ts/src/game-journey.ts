import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { playedRules } from '@libs/game-session-harness-ts/played-rules';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, hostSpace, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import {
  expectMultiplayerLoss,
  expectMultiplayerWin,
  expectSharedMultiplayerGame,
  tapFindOpponent,
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
    await tapFindOpponent(ui);
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

const SIDES = ['white', 'black'] as const;
type Side = (typeof SIDES)[number];

/**
 * The side this device's person prepares a private setup for: the one
 * whose name, as the panel lists who is ready, their own seat says they play.
 */
async function setupSide(ui: Driver): Promise<Side> {
  const colour = ui.get('multiplayer-colour');
  await colour.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const playing = (await colour.text()) ?? '';
  for (const side of SIDES) {
    const listed = ui.get(`multiplayer-setup-readiness-${side}`);
    await listed.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    const name = ((await listed.text()) ?? '')
      .replace(/(Getting ready|Ready)\s*$/, '')
      .trim();
    if (name !== '' && playing.includes(name)) return side;
  }
  throw new Error(
    'The matched game does not say which side this person sets up'
  );
}

/**
 * Arrange this person's side's known setup on the setup board of their
 * matched game, as they would place it, and choose it; resolves the side.
 */
function readyKnownSetup(
  game: PlayableGame,
  found: (side: Side) => unknown
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    const { arrange } = game.shared.automation.turns;
    const setups = game.fixtures.setups;
    if (arrange === undefined || setups === undefined)
      throw new Error(`${game.label} has no known setups to arrange`);
    const side = await setupSide(ui);
    await arrange(ui, 'multiplayer-setup', setups[side]);
    const choose = ui.get('multiplayer-setup-choose');
    await choose.wait('enabled', { timeoutMs: JOURNEY_WAIT_MS });
    await choose.tap({ timeoutMs: JOURNEY_WAIT_MS });
    await choose.expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    found(side);
  };
}

/** Both setups are chosen: the panel waiting for them has gone. */
async function setupsChosen(ui: Driver): Promise<void> {
  await ui
    .get('multiplayer-setup-status')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
}

/**
 * Both people ready their side's known setup, so the authority resolves the
 * known victory's proposals against them. Whether the person who opened the
 * app plays the first side.
 */
async function readyKnownSetups(
  host: JourneyHost,
  game: PlayableGame
): Promise<boolean> {
  const hostSides: Side[] = [];
  await host.act(
    'readyPrivateSetup',
    readyKnownSetup(game, (side) => hostSides.push(side))
  );
  await host.actAsGuest(
    'readyPrivateSetup',
    readyKnownSetup(game, () => undefined)
  );
  await host.act('awaitPrivateSetups', setupsChosen);
  await host.actAsGuest('awaitPrivateSetups', setupsChosen);
  return hostSides[0] === 'white';
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
  await ui.get('multiplayer-offline').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
  await game.shared.automation.turns.perform(
    ui,
    Handles.multiplayerBoard,
    action
  );
  await ui
    .get(`multiplayer-move-${ply}`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/**
 * Two people find each other for `game`, ready their sides' known setups if
 * it has private setups, and play its known victory to the end.
 */
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
  if (game.fixtures.setups === undefined)
    await host.act('readGameSide', async (ui) => {
      first = await playsFirst(ui);
    });
  else first = await readyKnownSetups(host, game);
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
  // A game with private setups resolves the victory's proposals against them.
  const { setups, firstSideVictory: victory } = game.fixtures;
  const rules = game.shared.turnGame.rules;
  const finished = (
    setups === undefined ? rules : playedRules(rules, setups)
  ).replay(victory, victory.length);
  const sameGame = async (ui: Driver) => {
    check(
      (await ui.get('multiplayer-game').attribute('data-fen')) === finished,
      'The finished game lost a move'
    );
  };
  await winner('observeGameVictory', async (ui) => {
    await expectMultiplayerWin(ui);
    await sameGame(ui);
  });
  await loser('observeGameDefeat', async (ui) => {
    await expectMultiplayerLoss(ui);
    await sameGame(ui);
  });
}
