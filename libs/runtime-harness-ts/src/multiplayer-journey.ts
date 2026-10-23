import { TURN_GAMES } from '@libs/game-catalog-shared-ts/turn-games';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  atTabShell,
  check,
  hostSpace,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';
import {
  endMultiplayerSpace,
  retirePreviousMultiplayer,
} from './multiplayer-search-recovery';
import { chooseMultiplayerTimeControl } from './multiplayer-time-control-gesture';

/** The device shows a matched game of a registered game other than chess. */
async function showsAnotherGame(ui: Driver): Promise<boolean> {
  if (!(await ui.get('multiplayer-game').isVisible())) return false;
  const position = await ui.get('multiplayer-game').attribute('data-fen');
  return TURN_GAMES.games.some(
    (game) =>
      game.rules.id !== 'chess' &&
      position !== null &&
      game.rules.recognizes(position)
  );
}

export async function openMultiplayerJourney(ui: Driver): Promise<void> {
  // A parked device reads as blank until its chrome is in front. Deciding
  // from that blank read hosts a new space and waits for a control the open
  // game does not have.
  await atTabShell(ui);
  if (
    (await showsAnotherGame(ui)) ||
    (!(await ui.get('game-choice-multiplayer').isVisible()) &&
      !(await ui.get('multiplayer-game').isVisible()))
  ) {
    await hostSpace(ui);
    await tap(ui, 'game-menu-chess');
  }
  if (await ui.get('game-choice-multiplayer').isVisible())
    await tap(ui, 'game-choice-multiplayer');
}

const SURFACE_POLLS = 10;
const SURFACE_SETTLE_MS = JOURNEY_WAIT_MS / SURFACE_POLLS;

/**
 * Wait for the screen to offer Find or the guest's invitation. Checking the
 * invitation once, before the screen has decided, falls through to a Find
 * that never comes.
 */
async function guestInvited(ui: Driver): Promise<boolean> {
  for (let poll = 0; poll < SURFACE_POLLS; poll += 1) {
    if (await ui.get('multiplayer-access-denial-action').isVisible())
      return true;
    try {
      await ui
        .get('multiplayer-find')
        .expect.visible({ timeoutMs: SURFACE_SETTLE_MS });
      return false;
    } catch {
      // Still loading, or the invitation is showing instead.
    }
  }
  return ui.get('multiplayer-access-denial-action').isVisible();
}

/**
 * Find an opponent once the app has the connection a server-decided command
 * needs. A device that has only just opened has not finished its first sync,
 * and the app refuses the command until it has; over a real network that
 * takes several round trips, and a person waits for the notice to go.
 */
export async function tapFindOpponent(ui: Driver): Promise<void> {
  await ui.get('multiplayer-offline').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
  await tap(ui, 'multiplayer-find');
}

/** Choose the time control (`5+0`), then find an opponent at it. */
export function startMultiplayerSearch(
  timeControl: string
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await openMultiplayerJourney(ui);
    await retirePreviousMultiplayer(ui);
    // The permission surface is the guest's invitation; no command is offered.
    if (await guestInvited(ui)) return;
    await chooseMultiplayerTimeControl(ui, timeControl);
    await tapFindOpponent(ui);
  };
}

/** A Given search is established once the server's waiting row is shown. */
export function establishMultiplayerSearch(
  timeControl: string
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await startMultiplayerSearch(timeControl)(ui);
    await ui
      .get('multiplayer-waiting')
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  };
}

/** Whether this device's person plays White in the shown game. */
async function playsWhite(ui: Driver): Promise<boolean> {
  await ui
    .get('multiplayer-colour')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  return ((await ui.get('multiplayer-colour').text()) ?? '').includes('White');
}

const MOVE_ATTEMPTS = 6;
const MOVE_SETTLE_MS = JOURNEY_WAIT_MS / MOVE_ATTEMPTS;

/**
 * A move by tapping its two squares, at their centres on this board. The
 * board takes no move while the person's earlier choice, or the opponent's
 * move, still settles, and over a real network that takes several round
 * trips. A person sees the board ignore them and plays again, so this does.
 */
function tapMove(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  expectedMoves: string,
  previousMoves?: string
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    if (previousMoves !== undefined)
      await ui.get('multiplayer-move-list').expect.text(previousMoves, {
        exact: false,
        timeoutMs: JOURNEY_WAIT_MS,
      });
    const board = ui.get('multiplayer-board');
    const moveList = ui.get('multiplayer-move-list');
    for (let attempt = 0; attempt < MOVE_ATTEMPTS; attempt += 1) {
      await board.layout();
      await board.tapAt({ xRatio: from.x / 8, yRatio: from.y / 8 });
      await board.tapAt({ xRatio: to.x / 8, yRatio: to.y / 8 });
      try {
        await moveList.expect.text(expectedMoves, {
          exact: false,
          timeoutMs: MOVE_SETTLE_MS,
        });
        return;
      } catch {
        // The board was not taking moves yet; play it again.
      }
    }
    await moveList.expect.text(expectedMoves, {
      exact: false,
      timeoutMs: MOVE_SETTLE_MS,
    });
  };
}

/** White's board: e2 to e4. Black's board is turned round: e7 to e5. */
export const PLAY_E4 = tapMove({ x: 4.5, y: 6.5 }, { x: 4.5, y: 4.5 }, '1. e4');
export const PLAY_E5 = tapMove(
  { x: 3.5, y: 6.5 },
  { x: 3.5, y: 4.5 },
  '1. e4 e5',
  '1. e4'
);

/** Whoever plays White opens with e4, and the other answers e5. */
export async function openWithE4AndE5(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>
): Promise<void> {
  let firstIsWhite = false;
  await host.act('readMultiplayerColour', async (ui) => {
    firstIsWhite = await playsWhite(ui);
  });
  const [white, black] = firstIsWhite
    ? [host.act, host.actAsGuest]
    : [host.actAsGuest, host.act];
  await white('playMultiplayerE4', PLAY_E4);
  await black('playMultiplayerE5', PLAY_E5);
}

export async function resignMultiplayerJourney(ui: Driver): Promise<void> {
  await tap(ui, 'multiplayer-resign');
  await tap(ui, 'multiplayer-confirm');
  await tap(ui, 'multiplayer-dismiss');
}

export async function expectMultiplayerInvitation(ui: Driver): Promise<void> {
  await ui
    .get('multiplayer-access-denial')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get('multiplayer-access-denial-action')
    .expect.text('Sign in', { exact: false });
}

export async function expectNoMultiplayerGame(ui: Driver): Promise<void> {
  await ui.get('multiplayer-game').expect.hidden();
  await ui.get('multiplayer-waiting').expect.hidden();
}

/** Observe the rendered board, rather than a server or local database row. */
async function shownGameId(ui: Driver, timeoutMs: number): Promise<string> {
  await ui.get('multiplayer-game').expect.visible({ timeoutMs });
  // The previous completed board stays visible while a new search runs.
  // A fresh pairing offers Abort until either person has played.
  await ui.get('multiplayer-abort').expect.visible({ timeoutMs });
  const html = await ui.snapshotHtml();
  const tag = html?.match(/<[^>]*data-testid="multiplayer-game"[^>]*>/)?.[0];
  const id = tag?.match(/data-game-id="([^"]+)"/)?.[1];
  check(
    id !== undefined && id.length > 0,
    'the multiplayer board has no game identity'
  );
  return id;
}

export async function expectSharedMultiplayerGame(
  host: Pick<JourneyHost, 'act' | 'actAsGuest' | 'now'>,
  timeoutMs: number
): Promise<void> {
  const deadline = (await host.now()) + timeoutMs;
  let first = '';
  let second = '';
  await host.act('observeMultiplayerGame', async (ui) => {
    first = await shownGameId(ui, timeoutMs);
  });
  const remaining = deadline - (await host.now());
  check(
    remaining >= 0,
    'the multiplayer game did not arrive within the deadline'
  );
  await host.actAsGuest('observeMultiplayerGame', async (ui) => {
    second = await shownGameId(ui, remaining);
  });
  check(
    (await host.now()) <= deadline,
    'the multiplayer game did not arrive within the deadline'
  );
  check(first === second, 'the two people see different multiplayer games');
}

export async function expectMultiplayerWin(ui: Driver): Promise<void> {
  await ui
    .get('multiplayer-announcement')
    .expect.text('You won the multiplayer game.', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}

export async function expectMultiplayerLoss(ui: Driver): Promise<void> {
  await ui
    .get('multiplayer-announcement')
    .expect.text('Your opponent won the multiplayer game.', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}

export async function prepareMultiplayerPair(host: JourneyHost): Promise<void> {
  await host.open('signed-in');
  await host.openPeer('signed-in');
  host.defer('multiplayer-host-space', endMultiplayerSpace);
  host.defer('multiplayer-peer-space', () =>
    host.actAsGuest('endPeerSpace', endMultiplayerSpace)
  );
}

export async function prepareUnfinishedMultiplayerGame(
  host: JourneyHost
): Promise<void> {
  await prepareMultiplayerPair(host);
  await host.act(
    'establishMultiplayerSearch',
    establishMultiplayerSearch('5+0')
  );
  await host.actAsGuest(
    'startMultiplayerSearch',
    startMultiplayerSearch('5+0')
  );
  // This Given establishes a game for recovery; the separate timed Then
  // checks the five-second pairing promise. Use the ordinary setup bound.
  await expectSharedMultiplayerGame(host, JOURNEY_WAIT_MS);
  await openWithE4AndE5(host);
}
