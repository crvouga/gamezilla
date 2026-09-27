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

/** Bring the actor's app to the front without asserting anything on it. */
async function focused(s: ProductSim, actorId: string) {
  const ui = await actorUi(s, actorId);
  await ui.get('sim-focus-probe').expect.hidden({ timeoutMs: 1 });
  return ui;
}

async function shown(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<boolean> {
  try {
    return await (await focused(s, actorId)).get(handle).isVisible();
  } catch {
    return false;
  }
}

/** Search has settled and found nobody (focuses the actor). */
export async function searchShowsNobody(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  return await shown(s, actorId, Handles.searchEmpty);
}

/** Search says it needs an account, in place of results (focuses the actor). */
export async function searchNeedsAccount(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  return await shown(s, actorId, Handles.searchDenied);
}

/** People search is open and ready for a name (focuses the actor). */
export async function peopleSearchOpen(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  return await shown(s, actorId, Handles.searchInput);
}

/** Search says it needs a connection, in place of results (focuses the actor). */
export async function searchNeedsConnection(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  return await shown(s, actorId, Handles.searchNeedsConnection);
}
