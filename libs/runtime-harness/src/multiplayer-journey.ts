import type { Driver } from '@pkgs/ui-testing-shared/driver';
import { check, JOURNEY_WAIT_MS, openTab, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';

export async function openMultiplayerJourney(ui: Driver): Promise<void> {
  await openTab(ui, 'tab-chess');
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
    if (await ui.get('multiplayer-access-denial').isVisible()) return true;
    try {
      await ui
        .get('multiplayer-find')
        .expect.visible({ timeoutMs: SURFACE_SETTLE_MS });
      return false;
    } catch {
      // Still loading, or the invitation is showing instead.
    }
  }
  return ui.get('multiplayer-access-denial').isVisible();
}

export async function startMultiplayerSearch(ui: Driver): Promise<void> {
  await openMultiplayerJourney(ui);
  // The permission surface is the guest's invitation; no command is offered.
  if (await guestInvited(ui)) return;
  await tap(ui, 'multiplayer-find');
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
  host: JourneyHost,
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
}

export async function prepareUnfinishedMultiplayerGame(
  host: JourneyHost
): Promise<void> {
  await prepareMultiplayerPair(host);
  await host.act('startMultiplayerSearch', startMultiplayerSearch);
  await host.actAsGuest('startMultiplayerSearch', startMultiplayerSearch);
  await expectSharedMultiplayerGame(host, 5000);
}
