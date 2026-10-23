import { Handles } from '@libs/test-ids-shared-ts/handles';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { Chess } from 'chess.js';
import { check, expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';

async function openConnectedCustomGame(ui: Driver): Promise<void> {
  await tap(ui, Handles.gameMenu('chess'));
  await tap(ui, 'game-choice-custom-game');
  await expectVisible(ui, 'custom-game-status');
  // The menu renders from local state before the room's first sync. Wait for
  // its connection notice to clear before submitting a server-backed choice.
  await ui.get('custom-game-connection-needed').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function prepareCustomGame(ui: Driver): Promise<void> {
  await openConnectedCustomGame(ui);
  await tap(ui, 'custom-game-create');
  await tap(ui, 'custom-game-black-choices');
  await tap(ui, 'custom-game-black-bot');
  await tap(ui, 'custom-game-ready');
  await ui.get('custom-game-startable').expect.text('Ready to start.', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function startCustomGame(ui: Driver): Promise<void> {
  // This gesture belongs to the offline scenario. A network cut is silent
  // until the room's 20s heartbeat plus 8s acknowledgement deadline expires.
  await ui.get('custom-game-connection-needed').expect.visible({
    timeoutMs: 30_000,
  });
  await tap(ui, 'custom-game-start');
}

export async function startCustomGameAgainstBot(ui: Driver): Promise<void> {
  await openConnectedCustomGame(ui);
  await tap(ui, 'custom-game-play-bot');
}

export async function expectCustomGameReady(ui: Driver): Promise<void> {
  await ui.get('custom-game-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
  await expectVisible(ui, 'custom-game-board');
  const box = await ui.get('custom-game-board').layout();
  check(box !== null && box.width > 0 && box.height > 0, 'board has no size');
}

const MOVE_ATTEMPTS = 6;
const MOVE_SETTLE_MS = JOURNEY_WAIT_MS / MOVE_ATTEMPTS;

/**
 * White plays e2-e4 on their own board. The board takes no move while the
 * person's earlier choice, such as starting the game, still waits for the
 * room to confirm it, and over a real network that takes several round
 * trips. A person sees the board ignore them and plays again, so this does.
 */
export async function playCustomGameE4(ui: Driver): Promise<void> {
  const board = ui.get('custom-game-board');
  for (let attempt = 0; attempt < MOVE_ATTEMPTS; attempt += 1) {
    await board.layout();
    // White's board: e2 and e4, at the centres of their squares.
    await board.tapAt({ xRatio: 4.5 / 8, yRatio: 6.5 / 8 });
    await board.tapAt({ xRatio: 4.5 / 8, yRatio: 4.5 / 8 });
    try {
      await ui
        .get('custom-game-review-move-1')
        .expect.text('e4', { exact: true, timeoutMs: MOVE_SETTLE_MS });
      return;
    } catch {
      // The board was not taking moves yet; play it again.
    }
  }
  await ui
    .get('custom-game-review-move-1')
    .expect.text('e4', { exact: true, timeoutMs: MOVE_SETTLE_MS });
}

export async function expectCustomGameBotReply(ui: Driver): Promise<void> {
  await expectVisible(ui, 'custom-game-review-move-2');
  await ui.get('custom-game-review-move-1').expect.text('e4', { exact: true });
  const reply = await ui.get('custom-game-review-move-2').text();
  check(reply !== null && reply.trim() !== '', 'bot reply is missing');
  const chess = new Chess();
  chess.move('e4');
  chess.move(reply.trim());
  check(chess.turn() === 'w', 'bot reply did not return White’s turn');
  await ui.get('custom-game-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function resignCustomGame(ui: Driver): Promise<void> {
  await tap(ui, 'custom-game-resign');
  await tap(ui, 'custom-game-resign-confirm');
  await tap(ui, 'custom-game-resign-done');
}

export async function expectCustomGameResigned(ui: Driver): Promise<void> {
  await ui.get('custom-game-status').expect.text('Black wins by resignation.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
  await expectVisible(ui, 'custom-game-rematch');
  await ui.get('custom-game-resign').expect.hidden();
  await ui.get('custom-game-review-move-1').expect.text('e4', { exact: true });
  await expectVisible(ui, 'custom-game-review-move-2');
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
    if (await ui.get('custom-game-status').isVisible()) break;
    await tapIfShown(ui, Handles.gameMenu('chess'));
    await tapIfShown(ui, 'game-choice-custom-game');
    try {
      await ui
        .get('custom-game-status')
        .expect.visible({ timeoutMs: SCREEN_SETTLE_MS });
    } catch {
      // Still on the way.
    }
  }
  await expectVisible(ui, 'custom-game-status');
  await ui.get('custom-game-connection-needed').expect.hidden({
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

/** The host creates a game and invites the one other person to Black. */
export async function inviteToBlack(ui: Driver): Promise<void> {
  await openCustomGameJourney(ui);
  await tap(ui, 'custom-game-create');
  await tap(ui, 'custom-game-black-choices');
  await tap(ui, 'custom-game-black-invite-choose');
  await tap(ui, 'custom-game-black-invitable');
  await tap(ui, 'custom-game-black-invite');
  await ui.get('custom-game-black-person').expect.text('Invited:', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

/** The name White's side shows: the creator's, on the creator's device. */
export async function readWhiteName(ui: Driver): Promise<string> {
  await expectVisible(ui, 'custom-game-white-person');
  const name = (await ui.get('custom-game-white-person').text())?.trim();
  check(name !== undefined && name !== '', 'White shows no name');
  return name;
}

export function expectInvitationToBlack(
  creator: string
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await openCustomGameJourney(ui);
    const invitation = ui.get('custom-game-black-invitation');
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
  await tap(ui, 'custom-game-black-accept');
  await expectVisible(ui, 'custom-game-black-release');
}

/** The person holds Black: theirs to release, and named on Black's side. */
export async function readOwnBlackName(ui: Driver): Promise<string> {
  await expectVisible(ui, 'custom-game-black-release');
  const name = (await ui.get('custom-game-black-person').text())?.trim();
  check(name !== undefined && name !== '', 'Black shows no name');
  return name;
}

export function expectBlackNamed(name: string): (ui: Driver) => Promise<void> {
  return (ui) =>
    ui.get('custom-game-black-person').expect.text(name, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}

export async function becomeReady(ui: Driver): Promise<void> {
  await openCustomGameJourney(ui);
  await tap(ui, 'custom-game-ready');
  await ui.get('custom-game-ready').expect.text('Withdraw readiness', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function expectStartable(ui: Driver): Promise<void> {
  await ui.get('custom-game-startable').expect.text('Ready to start.', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function startReadyGame(ui: Driver): Promise<void> {
  await expectStartable(ui);
  await tap(ui, 'custom-game-start');
  await ui.get('custom-game-status').expect.text('White to move.', {
    exact: false,
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export function expectBoardFacing(
  side: 'white' | 'black'
): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await expectVisible(ui, 'custom-game-board');
    const a1 = await readCornerPosition(ui, 'a1');
    const h8 = await readCornerPosition(ui, 'h8');
    const white = a1.x < h8.x && a1.y > h8.y;
    const black = a1.x > h8.x && a1.y < h8.y;
    check(side === 'white' ? white : black, `the board does not face ${side}`);
  };
}

/** Read the square transforms that place the shipped board's visible corners. */
async function readCornerPosition(
  ui: Driver,
  square: 'a1' | 'h8'
): Promise<{ x: number; y: number }> {
  const style = await ui
    .get(chessBoardSquareTestId('custom-game-board', square))
    .attribute('style');
  const position = style?.match(
    /translate\(\s*(\d+(?:\.\d+)?)cqw,\s*(\d+(?:\.\d+)?)cqw\s*\)/
  );
  check(
    position !== undefined && position !== null,
    'board square positions are missing'
  );
  return { x: Number(position[1]), y: Number(position[2]) };
}

export function expectMoveListed(san: string): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await ui.get('custom-game-review-move-1').expect.text(san, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  };
}

export function expectOutcome(
  description: string
): (ui: Driver) => Promise<void> {
  return (ui) =>
    ui.get('custom-game-status').expect.text(description, {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
}
