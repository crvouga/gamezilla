/** What a person does in a hosted space: see the games, open a chess puzzle. */

import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';
import { check, expectVisible, tap } from './journey-gestures';

const BOARD_MEASURE_LIMIT = 20;
const BOARD_SETTLE_MS = 1_000;

export async function expectGamesOffered(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.gameMenuChess);
}

export async function startChessPuzzle(ui: Driver): Promise<void> {
  await tap(ui, Handles.gameMenuChess);
  await tap(ui, Handles.chessMenuPuzzle);
  await expectVisible(ui, Handles.chessPuzzlePlayScreen);
}

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
  await expectVisible(ui, Handles.chessPuzzleBoard);
  const box = await board.layout();
  check(
    box !== null && box.width > 0 && box.height > 0,
    `the puzzle board has no size: ${JSON.stringify(box)}`
  );
}

/**
 * A puzzle arrived from the live pool and its board is on screen. Solving
 * needs the answer, which production never ships to the page — so this
 * proves the puzzle loaded and is playable, not a solve.
 */
export async function expectPuzzlePlayable(ui: Driver): Promise<void> {
  await expectBoardLaidOut(ui);
  await expectVisible(ui, Handles.chessPuzzleActionHint);
  check(
    !(await ui.get(Handles.chessPuzzleEmptyPool).isVisible()),
    'the puzzle pool is empty: no puzzle to play'
  );
}

export async function expectSpaceEnded(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.spaceEnded);
}
