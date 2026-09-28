import { actorUi } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { Handles } from '@libs/test-ids';

export async function chessGameMenuVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.chessMenuPuzzle).isVisible();
  } catch {
    return false;
  }
}
