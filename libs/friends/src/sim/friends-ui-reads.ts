import { actorUi } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';

/**
 * Bring the actor's phone to the front without asserting anything on it:
 * waits (unlike `isVisible` / `text`) focus the actor, and nothing carries
 * this id, so the wait returns at once.
 */
async function focus(ui: Awaited<ReturnType<typeof actorUi>>): Promise<void> {
  await ui.get('sim-focus-probe').expect.hidden({ timeoutMs: 1 });
}

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

/** The number on the Profile tab's friends row (opens the tab). */
export async function readFriendsCount(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    if (
      !(await ui.get(Handles.tabProfile).isVisible()) &&
      (await ui.get(Handles.navBack).isVisible())
    ) {
      await ui.get(Handles.navBack).tap({ timeoutMs: 2_000 });
    }
    await ui.get(Handles.tabProfile).tap({ timeoutMs: 2_000 });
    const count = ui.get(Handles.profileFriendsCount);
    await count.expect.visible({ timeoutMs: 5_000 });
    const text = await count.text();
    return text === null ? null : text.trim();
  } catch {
    return null;
  }
}

/** `handle` is on the actor's screen right now (focuses the actor). */
export async function handleVisible(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    return await ui.get(handle).isVisible();
  } catch {
    return false;
  }
}

/** Text of `handle` on the actor's screen, trimmed; null when absent (focuses the actor). */
export async function handleText(
  s: ProductSim,
  actorId: string,
  handle: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    const text = await ui.get(handle).text();
    return text === null ? null : text.trim();
  } catch {
    return null;
  }
}

/** `actorId`'s friends list badges the friend with account `hostAccountId` as in a live space. */
export async function friendLiveBadgeVisible(
  s: ProductSim,
  actorId: string,
  hostAccountId: string
): Promise<boolean> {
  const ui = s.actors.get(actorId)?.ui;
  if (ui === undefined) return false;
  return await ui.get(Handles.friendLiveSpace(hostAccountId)).isVisible();
}
