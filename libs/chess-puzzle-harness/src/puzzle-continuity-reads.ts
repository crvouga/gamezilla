import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';
import { isPuzzleBoardInteractive } from './chess-puzzle-solve-ui';
import { readActivePuzzleId } from './chess-puzzle-ui';

/** The saved board is still the same playable attempt. */
export async function samePuzzlePlayable(
  s: ProductHarness,
  actor: string,
  puzzle: string
): Promise<boolean> {
  return (
    (await readActivePuzzleId(s, actor)) === puzzle &&
    (await isPuzzleBoardInteractive(s, actor))
  );
}

/** The puzzle's back control remains offered even when no puzzle arrived. */
export async function puzzleExitOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return ui.get(Handles.navBack).isVisible();
}
