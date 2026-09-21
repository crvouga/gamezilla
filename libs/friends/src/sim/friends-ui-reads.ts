import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

export async function friendRowVisible(
  s: ProductSim,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.friendsListRow(username)).isVisible();
  } catch {
    return false;
  }
}

/** The inbox shows a friend request from `fromUsername` (opens the tab). */
export async function friendRequestCardVisible(
  s: ProductSim,
  actorId: string,
  fromUsername: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    // Tapping focuses the actor (a parked actor's screen reads as empty).
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: 2_000 });
    return await ui
      .get(Handles.notificationsFriendRequestCard(fromUsername))
      .isVisible();
  } catch {
    return false;
  }
}

/** A search result row for `username` offers Add (no friendship, no pending request). */
export async function addFriendOffered(
  s: ProductSim,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    return await ui.get(Handles.friendAdd(username)).isVisible();
  } catch {
    return false;
  }
}
