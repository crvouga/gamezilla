/**
 * The chess board a played puzzle is reviewed on, as it draws itself. The
 * review's controls and probes are every game's
 * (`@libs/game-session-harness-ts/puzzle-records`).
 */

import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared-ts/flows';

/** Actual public board state; the review's own timeline probe is separate. */
export async function readRenderedPuzzleReviewBoard(
  s: ProductHarness,
  actorId: string
) {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleBoardFrame).layout();
  await ui.get(Handles.chessPuzzleReviewBoard).layout();
  return new ChessBoardFlows(ui, Handles.chessPuzzleReviewBoard).readProbe();
}
