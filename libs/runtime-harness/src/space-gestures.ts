/** What a person does in a hosted space: see the games, open a chess puzzle. */

import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { check, expectVisible, tap } from './journey-gestures';

const BOARD_MEASURE_LIMIT = 20;
const BOARD_SETTLE_MS = 1_000;

export async function expectGamesOffered(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.gameMenu('chess'));
}

export async function startChessPuzzle(ui: Driver): Promise<void> {
  await tap(ui, Handles.gameMenu('chess'));
  await tap(ui, Handles.gameChoice('puzzle'));
  await expectVisible(ui, Handles.chessPuzzlePlayScreen);
}

/**
 * The board mounts once its frame has a size, and the frame re-mounts when
 * the puzzle arrives: measure, look, repeat — a real browser lays out on its
 * own, the harness's DOM measures when asked. Then the board must have a size.
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

/** Inside the space: its close control is up (the same signal as an active space). */
export async function expectInSpace(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.spaceClose);
}

const LINK_POLLS = 10;
const LINK_SETTLE_MS = 2_000;

type LinkOffer = 'join' | 'ended' | 'inside';

async function linkOffer(ui: Driver): Promise<LinkOffer | null> {
  if (await ui.get(Handles.spaceEnded).isVisible()) return 'ended';
  if (await ui.get(Handles.spaceClose).isVisible()) return 'inside';
  if (await ui.get(Handles.spaceJoin).isVisible()) return 'join';
  return null;
}

/**
 * The space link is already open. Join when it offers to. An ended space
 * does not, and this does not invent a join.
 */
export async function joinFromLink(ui: Driver): Promise<void> {
  for (let attempt = 0; attempt < LINK_POLLS; attempt += 1) {
    const offer = await linkOffer(ui);
    if (offer === 'ended' || offer === 'inside') return;
    if (offer === 'join') {
      await tap(ui, Handles.spaceJoin);
      return;
    }
    try {
      await ui
        .get(Handles.spaceJoin)
        .expect.visible({ timeoutMs: LINK_SETTLE_MS });
    } catch {
      // The link is still opening.
    }
  }
  throw new Error('the space link did not offer to join or say it ended');
}
