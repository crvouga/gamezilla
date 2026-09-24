import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

const WAIT_MS = 10_000;

/** True once `username`'s row shows in the actor's people search results. */
export async function searchResultVisible(
  s: ProductSim,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.searchUserResult(username))
      .expect.visible({ timeoutMs: WAIT_MS });
    return true;
  } catch {
    return false;
  }
}
