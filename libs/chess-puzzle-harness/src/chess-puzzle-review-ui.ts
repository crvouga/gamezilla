/**
 * The chess board a played puzzle is reviewed on, as it draws itself. The
 * review's controls and probes are every game's
 * (`@libs/game-session-harness/puzzle-records`).
 */

import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';

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
