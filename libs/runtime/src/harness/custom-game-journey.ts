import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';
import { Chess } from 'chess.js';
import {
  check,
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
} from './critical-journeys/journey-gestures';

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
  await ui.get('chess-custom-status').expect.text('Black wins.', {
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
