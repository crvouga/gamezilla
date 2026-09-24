/** Journeys through a hosted space: host and end one, open a chess puzzle. */

import { Handles } from '@libs/test-ids';

import type { Driver } from '@pkgs/ui-testing';
import {
  check,
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
  withHostedSpace,
} from './journey-steps';
import type { CriticalJourney } from './journey-types';

const BOARD_MEASURE_LIMIT = 20;
const BOARD_SETTLE_MS = 1_000;

/**
 * The board mounts once its frame has a size, and the frame re-mounts when
 * the puzzle arrives: measure, look, repeat — a real browser lays out on its
 * own, the sim's DOM measures when asked. Then the board must have a size.
 */
async function expectBoardLaidOut(ui: Driver): Promise<void> {
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  const board = ui.get(Handles.chessPuzzleBoard);
  for (let attempt = 0; attempt < BOARD_MEASURE_LIMIT; attempt += 1) {
    await frame.layout();
    try {
      await board.expect.visible({ timeoutMs: BOARD_SETTLE_MS });
      break;
    } catch {
      // Not mounted yet; measure again.
    }
  }
  await board.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const box = await board.layout();
  check(
    box !== null && box.width > 0 && box.height > 0,
    `the puzzle board has no size: ${JSON.stringify(box)}`
  );
}

/** `withHostedSpace` hosts, then ends the space and sees it ended. */
export const hostAndEndSpace: CriticalJourney = {
  id: 'host-and-end-space',
  title: 'A person hosts a space and ends it',
  access: 'signed-in',
  requiresBrowser: false,
  run: async ({ ui }) => {
    await withHostedSpace(ui, async () => {
      await expectVisible(ui, Handles.gameMenuChess);
    });
  },
};

/**
 * A puzzle arrives from the live pool and its board is on screen. Solving
 * needs the answer, which production never ships to the page — so the
 * journey proves the puzzle loaded and is playable, not a solve.
 */
export const chessPuzzleOpens: CriticalJourney = {
  id: 'chess-puzzle-opens',
  title: 'A person opens a chess puzzle in a space and gets a playable board',
  access: 'signed-in',
  requiresBrowser: false,
  run: async ({ ui }) => {
    await withHostedSpace(ui, async () => {
      await tap(ui, Handles.gameMenuChess);
      await tap(ui, Handles.chessMenuPuzzle);
      await expectVisible(ui, Handles.chessPuzzlePlayScreen);
      await expectBoardLaidOut(ui);
      await expectVisible(ui, Handles.chessPuzzleActionHint);
      check(
        !(await ui.get(Handles.chessPuzzleEmptyPool).isVisible()),
        'the puzzle pool is empty: no puzzle to play'
      );
    });
  },
};
