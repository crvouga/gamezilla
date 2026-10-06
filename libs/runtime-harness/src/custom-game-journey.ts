import { Handles } from '@libs/test-ids-shared/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { Chess } from 'chess.js';
import { check, expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';

async function openConnectedCustomGame(ui: Driver): Promise<void> {
  await tap(ui, Handles.gameMenuChess);
  await tap(ui, 'chess-menu-custom-game');
  await expectVisible(ui, 'chess-custom-status');
  // The menu renders from local state before the room's first sync. Wait for
  // its connection notice to clear before submitting a server-backed choice.
  await ui.get('chess-custom-connection-needed').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function prepareCustomGame(ui: Driver): Promise<void> {
  await openConnectedCustomGame(ui);
  await tap(ui, 'chess-custom-create');
  await tap(ui, 'chess-custom-black-choices');
  await tap(ui, 'chess-custom-black-bot');
  await tap(ui, 'chess-custom-ready');
  await ui.get('chess-custom-startable').expect.text('Ready to start.', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function startCustomGame(ui: Driver): Promise<void> {
  // This gesture belongs to the offline scenario. A network cut is silent
  // until the room's 20s heartbeat plus 8s acknowledgement deadline expires.
  await ui.get('chess-custom-connection-needed').expect.visible({
    timeoutMs: 30_000,
  });
  await tap(ui, 'chess-custom-start');
}

export async function startCustomGameAgainstBot(ui: Driver): Promise<void> {
  await openConnectedCustomGame(ui);
  await tap(ui, 'chess-custom-play-bot');
}

export async function expectCustomGameReady(ui: Driver): Promise<void> {
  await ui.get('chess-custom-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
  await expectVisible(ui, 'chess-custom-board');
  const box = await ui.get('chess-custom-board').layout();
  check(box !== null && box.width > 0 && box.height > 0, 'board has no size');
}

export async function playCustomGameE4(ui: Driver): Promise<void> {
  await ui.get('chess-custom-board').layout();
  // White's board: e2 and e4, at the centres of their squares.
  await ui
    .get('chess-custom-board')
    .tapAt({ xRatio: 4.5 / 8, yRatio: 6.5 / 8 });
  await ui
    .get('chess-custom-board')
    .tapAt({ xRatio: 4.5 / 8, yRatio: 4.5 / 8 });
}

export async function expectCustomGameBotReply(ui: Driver): Promise<void> {
  await expectVisible(ui, 'chess-custom-review-move-2');
  await ui.get('chess-custom-review-move-1').expect.text('e4', { exact: true });
  const reply = await ui.get('chess-custom-review-move-2').text();
  check(reply !== null && reply.trim() !== '', 'bot reply is missing');
  const chess = new Chess();
  chess.move('e4');
  chess.move(reply.trim());
  check(chess.turn() === 'w', 'bot reply did not return White’s turn');
  await ui.get('chess-custom-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function resignCustomGame(ui: Driver): Promise<void> {
  await tap(ui, 'chess-custom-resign');
  await tap(ui, 'chess-custom-resign-confirm');
  await tap(ui, 'chess-custom-resign-done');
}

export async function expectCustomGameResigned(ui: Driver): Promise<void> {
  await ui
    .get('chess-custom-status')
    .expect.text('Black wins by resignation.', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  await expectVisible(ui, 'chess-custom-rematch');
  await ui.get('chess-custom-resign').expect.hidden();
  await ui.get('chess-custom-review-move-1').expect.text('e4', { exact: true });
  await expectVisible(ui, 'chess-custom-review-move-2');
}

export async function expectCustomGameOffline(ui: Driver): Promise<void> {
  await ui
    .get('chess-custom-error')
    .expect.text('Reconnect before changing or playing the game.', {
      timeoutMs: JOURNEY_WAIT_MS,
    });
}

export async function expectCustomGameUnstarted(ui: Driver): Promise<void> {
  await ui
    .get('chess-custom-status')
    .expect.text('Ready to start.', { exact: false });
  await expectVisible(ui, 'chess-custom-start');
  await ui.get('chess-custom-resign').expect.hidden();
  await ui.get('chess-custom-review-move-1').expect.hidden();
}

const SCREEN_POLLS = 10;
const SCREEN_SETTLE_MS = JOURNEY_WAIT_MS / SCREEN_POLLS;

/** Tap `testId` if it shows now; the shared screen may move on first. */
async function tapIfShown(ui: Driver, testId: string): Promise<void> {
  if (!(await ui.get(testId).isVisible())) return;
  try {
    await ui.get(testId).tap({ timeoutMs: SCREEN_SETTLE_MS });
  } catch {
    // The space's shared screen moved on before the tap.
  }
}

/**
 * The Custom Game screen of the space the person is in, connected. The
 * space's screen is shared, so another person may move it there (or past
 * chess's menu) while this person is on the way.
 */
async function openCustomGameJourney(ui: Driver): Promise<void> {
  for (let poll = 0; poll < SCREEN_POLLS; poll += 1) {
    if (await ui.get('chess-custom-status').isVisible()) break;
    await tapIfShown(ui, Handles.gameMenuChess);
    await tapIfShown(ui, 'chess-menu-custom-game');
    try {
      await ui
        .get('chess-custom-status')
        .expect.visible({ timeoutMs: SCREEN_SETTLE_MS });
    } catch {
      // Still on the way.
    }
  }
  await expectVisible(ui, 'chess-custom-status');
  await ui.get('chess-custom-connection-needed').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

/** The host creates a game and invites the one other person to Black. */
export async function inviteToBlack(ui: Driver): Promise<void> {
  await openCustomGameJourney(ui);
  await tap(ui, 'chess-custom-create');
  await tap(ui, 'chess-custom-black-choices');
  await tap(ui, 'chess-custom-black-invite-choose');
  await tap(ui, 'chess-custom-black-invitable');
  await tap(ui, 'chess-custom-black-invite');
  await ui.get('chess-custom-black-person').expect.text('Invited:', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

/** The name White's side shows: the creator's, on the creator's device. */
export async function readWhiteName(ui: Driver): Promise<string> {
  await expectVisible(ui, 'chess-custom-white-person');
  const name = (await ui.get('chess-custom-white-person').text())?.trim();
  check(name !== undefined && name !== '', 'White shows no name');
  return name;
}

export function expectInvitationToBlack(
  creator: string
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await openCustomGameJourney(ui);
    const invitation = ui.get('chess-custom-black-invitation');
    await invitation.expect.text('invites you to play Black.', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
    await invitation.expect.text(creator, {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  };
}

export async function acceptBlack(ui: Driver): Promise<void> {
  await tap(ui, 'chess-custom-black-accept');
  await expectVisible(ui, 'chess-custom-black-release');
}

/** The person holds Black: theirs to release, and named on Black's side. */
export async function readOwnBlackName(ui: Driver): Promise<string> {
  await expectVisible(ui, 'chess-custom-black-release');
  const name = (await ui.get('chess-custom-black-person').text())?.trim();
  check(name !== undefined && name !== '', 'Black shows no name');
  return name;
}

export function expectBlackNamed(name: string): (ui: Driver) => Promise<void> {
  return (ui) =>
    ui.get('chess-custom-black-person').expect.text(name, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}

export async function becomeReady(ui: Driver): Promise<void> {
  await openCustomGameJourney(ui);
  await tap(ui, 'chess-custom-ready');
  await ui.get('chess-custom-ready').expect.text('Withdraw readiness', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function expectStartable(ui: Driver): Promise<void> {
  await ui.get('chess-custom-startable').expect.text('Ready to start.', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function startReadyGame(ui: Driver): Promise<void> {
  await expectStartable(ui);
  await tap(ui, 'chess-custom-start');
  await ui.get('chess-custom-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export function expectBoardFacing(
  side: 'white' | 'black'
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await expectVisible(ui, 'chess-custom-board');
    const probe = await new ChessBoardFlows(
      ui,
      'chess-custom-board'
    ).readProbe();
    check(
      probe.orientation === side,
      `the board faces ${probe.orientation}, not ${side}`
    );
  };
}

export function expectMoveListed(san: string): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await ui.get('chess-custom-review-move-1').expect.text(san, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  };
}

export function expectOutcome(
  description: string
): (ui: Driver) => Promise<void> {
  return (ui) =>
    ui.get('chess-custom-status').expect.text(description, {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}
