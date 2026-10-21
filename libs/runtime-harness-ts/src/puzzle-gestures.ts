/**
 * Solving a chess puzzle in a hosted space and finding the next one ready.
 * Solving plays the puzzle's own line off the board's test probes, which only
 * test builds render: a host whose build has none says so before this runs
 * ({@link JourneyHost.showsPuzzleAnswers}).
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared-ts/flows';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import { expectPuzzlePlayable } from './space-gestures';

/** A puzzle line is a handful of moves; a longer walk is a stuck board. */
const MOVE_LIMIT = 16;
/** Looks at the board before giving up on the next move appearing. */
const LOOK_LIMIT = 40;
const LOOK_SETTLE_MS = 500;

function stripProbe(text: string | null): string {
  return (text ?? '').replace(/​/g, '').trim().toLowerCase();
}

async function solved(ui: Driver): Promise<boolean> {
  return ui.get(Handles.chessPuzzleSummary).isVisible();
}

/** The move the line expects now, as the test probe shows it ('' if none). */
async function expectedMove(ui: Driver): Promise<string> {
  try {
    return stripProbe(await ui.get(Handles.chessPuzzleExpectedUci).text());
  } catch {
    return '';
  }
}

/**
 * Wait until the board settles on a move other than `played` for the person
 * to make, or the puzzle is solved (`null`). Letting time pass is a short
 * look at the solved summary.
 */
async function nextMove(ui: Driver, played: string): Promise<string | null> {
  for (let look = 0; look < LOOK_LIMIT; look += 1) {
    if (await solved(ui)) return null;
    await ui.get(Handles.chessPuzzleBoardFrame).layout();
    const uci = await expectedMove(ui);
    if (uci.length >= 4 && uci !== played) return uci;
    await ui
      .get(Handles.chessPuzzleSummary)
      .expect.visible({ timeoutMs: LOOK_SETTLE_MS })
      .catch(() => undefined);
  }
  throw new Error(`the puzzle offered no move after ${played || 'its start'}`);
}

/** Play the puzzle's line on the board until it is solved. */
export async function solveChessPuzzle(ui: Driver): Promise<void> {
  await expectPuzzlePlayable(ui);
  const board = new ChessBoardFlows(ui, Handles.chessPuzzleBoard);
  let played = '';
  for (let move = 0; move < MOVE_LIMIT; move += 1) {
    const uci = await nextMove(ui, played);
    if (uci === null) break;
    await ui.get(Handles.chessPuzzleBoard).layout();
    await board.drag(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square);
    played = uci;
  }
  await expectVisible(ui, Handles.chessPuzzleSummary);
}

/** Past the solved puzzle, the next one is laid out and ready to play. */
export async function expectNextPuzzleReady(ui: Driver): Promise<void> {
  await tap(ui, Handles.chessPuzzleSummaryNext);
  await ui
    .get(Handles.chessPuzzleSummary)
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await expectPuzzlePlayable(ui);
}
