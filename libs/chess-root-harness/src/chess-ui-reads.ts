import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

export async function chessGameMenuVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.gameChoice('puzzle')).isVisible();
  } catch {
    return false;
  }
}
