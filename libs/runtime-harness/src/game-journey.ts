import type { PlayableGame } from '@libs/game-session-harness/harness-game';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
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

/**
 * Ready a private setup with the setup panel's own controls: a random
 * setup, then choose it, as a person who does not place each piece would.
 * A fresh device knows no setup of its own, so the journey arranges none.
 */
async function readyRandomSetup(ui: Driver): Promise<void> {
  await tap(ui, 'multiplayer-setup-random');
  const choose = ui.get('multiplayer-setup-choose');
  await choose.wait('enabled', { timeoutMs: JOURNEY_WAIT_MS });
  await choose.tap({ timeoutMs: JOURNEY_WAIT_MS });
  await choose.expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
}

/** Both setups are chosen: the panel waiting for them has gone. */
async function setupsChosen(ui: Driver): Promise<void> {
  await ui
    .get('multiplayer-setup-status')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
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

/** What a move of a journey is: an action, or one chosen from the board shown. */
export type JourneyAction = string | ((position: string) => string);

/**
 * Make the `ply`-th move of a matched game on its board, once the
 * opponent's previous move has arrived, and wait for it to be accepted. A
 * chosen move is chosen from the position the board shows by then.
 */
export async function playJourneyMove(
  ui: Driver,
  game: PlayableGame,
  action: JourneyAction,
  ply: number
): Promise<void> {
  if (ply > 1)
    await ui
      .get(`multiplayer-move-${ply - 1}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const played =
    typeof action === 'string'
      ? action
      : action((await ui.get('multiplayer-game').attribute('data-fen')) ?? '');
  await game.shared.automation.perform(ui, Handles.multiplayerBoard, played);
  await ui
    .get(`multiplayer-move-${ply}`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/**
 * The longest game a journey plays before it gives up: Battleship's, where
 * each side may shoot each of its rival's 100 cells once.
 */
const JOURNEY_MOVE_LIMIT = 200;

/**
 * How the journey plays `game`: its known victory, or — for a game with
 * private setups, where no fresh device knows the setups that victory needs —
 * the game's automation's choices from each board, to whatever finish.
 */
function journeyLine(
  host: JourneyHost,
  game: PlayableGame
): (ply: number) => JourneyAction | null {
  if (game.shared.turnGame.rules.setup === undefined)
    return (ply) => game.fixtures.firstSideVictory[ply - 1] ?? null;
  const random = createSeededRng(`${host.runId}:${game.shared.id}`).random;
  return () => (position) => {
    const chosen = game.shared.automation.choose(position, random);
    if (chosen === null)
      throw new Error(`${game.label} offers no move in an unfinished game`);
    return chosen;
  };
}

/** A matched game a journey played to its finish. */
export type JourneyGame = {
  /** Whether the person who opened the app played the first side. */
  readonly first: boolean;
  /** The side that won, or `draw`. */
  readonly outcome: string;
  /** The finished position, as the last mover's board showed it. */
  readonly finished: string;
};

/** The {@link JourneyGame} a journey's `When` remembered, or a refusal. */
export function playedJourneyGame(value: unknown, label: string): JourneyGame {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('first' in value) ||
    !('outcome' in value) ||
    !('finished' in value)
  )
    throw new Error(`${label} did not start`);
  return value as JourneyGame;
}

/**
 * Two people find each other for `game`, ready their private setups if it
 * has them, and play it to its finish.
 */
export async function playGameJourney(
  host: JourneyHost,
  game: PlayableGame
): Promise<JourneyGame> {
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
  if (game.shared.turnGame.rules.setup !== undefined) {
    await host.act('readyPrivateSetup', readyRandomSetup);
    await host.actAsGuest('readyPrivateSetup', readyRandomSetup);
    await host.act('awaitPrivateSetups', setupsChosen);
    await host.actAsGuest('awaitPrivateSetups', setupsChosen);
  }
  let first = false;
  await host.act('readGameSide', async (ui) => {
    first = await playsFirst(ui);
  });
  const [mover, opponent] = first
    ? [host.act, host.actAsGuest]
    : [host.actAsGuest, host.act];
  const line = journeyLine(host, game);
  let outcome = 'ongoing';
  let finished = '';
  for (let ply = 1; outcome === 'ongoing'; ply += 1) {
    const action = line(ply);
    check(
      action !== null && ply <= JOURNEY_MOVE_LIMIT,
      `${game.label} did not finish after ${String(ply - 1)} moves`
    );
    await (ply % 2 === 1 ? mover : opponent)('playJourneyMove', async (ui) => {
      await playJourneyMove(ui, game, action, ply);
      const board = ui.get('multiplayer-game');
      outcome = (await board.attribute('data-outcome')) ?? 'ongoing';
      finished = (await board.attribute('data-fen')) ?? '';
    });
  }
  return { first, outcome, finished };
}

/** Both people see the same finished game: one won, the other lost. */
export async function observeGameJourney(
  host: JourneyHost,
  game: PlayableGame,
  played: JourneyGame
): Promise<void> {
  check(played.outcome !== 'draw', `${game.label} ended in a draw`);
  const victory = game.fixtures.firstSideVictory;
  if (game.shared.turnGame.rules.setup === undefined)
    check(
      played.finished ===
        game.shared.turnGame.rules.replay(victory, victory.length),
      'The finished game lost a move'
    );
  const firstWon = played.outcome === 'white';
  const [winner, loser] =
    played.first === firstWon
      ? [host.act, host.actAsGuest]
      : [host.actAsGuest, host.act];
  const sameGame = async (ui: Driver) => {
    check(
      (await ui.get('multiplayer-game').attribute('data-fen')) ===
        played.finished,
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
