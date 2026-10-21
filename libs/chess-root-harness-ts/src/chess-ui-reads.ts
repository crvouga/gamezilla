import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

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
