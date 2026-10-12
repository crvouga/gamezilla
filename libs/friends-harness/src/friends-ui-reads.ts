import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { openTab } from '@libs/harness/shell-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { showKnownPerson } from './known-person-view';

/**
 * Bring the actor's phone to the front without asserting anything on it:
 * waits (unlike `isVisible` / `text`) focus the actor, and nothing carries
 * this id, so the wait returns at once.
 */
async function focus(ui: Awaited<ReturnType<typeof actorUi>>): Promise<void> {
  await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
}

export async function friendRowVisible(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    return await ui.get(Handles.friendsListRow(username)).isVisible();
  } catch {
    return false;
  }
}

/** The inbox shows a friend request from `fromUsername` (opens the tab). */
export async function friendRequestCardVisible(
  s: ProductHarness,
  actorId: string,
  fromUsername: string
): Promise<boolean> {
  await Promise.resolve(openTab.act(s, actorId, Handles.tabNotifications));
  const ui = await actorUi(s, actorId);
  return await ui
    .get(Handles.notificationsFriendRequestCard(fromUsername))
    .isVisible();
}

/**
 * What the actor's inbox card for a friend request from `fromUsername` reads
 * (opens the tab); `null` while there is none.
 */
export async function friendRequestCardText(
  s: ProductHarness,
  actorId: string,
  fromUsername: string
): Promise<string | null> {
  await Promise.resolve(openTab.act(s, actorId, Handles.tabNotifications));
  const ui = await actorUi(s, actorId);
  const card = ui.get(Handles.notificationsFriendRequestCard(fromUsername));
  return (await card.isVisible()) ? await card.text() : null;
}

/** A search result row for `username` offers Add (no friendship, no pending request). */
export async function addFriendOffered(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    return await ui.get(Handles.friendAdd(username)).isVisible();
  } catch {
    return false;
  }
}

/** The number on the Profile tab's friends row (opens the tab). */
export async function readFriendsCount(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  hostAccountId: string
): Promise<boolean> {
  const ui = s.actors.get(actorId)?.ui;
  if (ui === undefined) return false;
  return await ui.get(Handles.friendLiveSpace(hostAccountId)).isVisible();
}

/** The username another person's profile shows (`@name`), or null (focuses the actor). */
export async function personProfileShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return await handleText(s, actorId, Handles.friendUserUsername);
}

/** The Add action shows the recent-decline refusal (focuses the actor). */
export async function recentDeclineRefusalShown(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  return (
    (await handleText(s, actorId, Handles.friendAdd(username))) ===
    'Try again later'
  );
}

/** The screen shows `username` as a friend (focuses the actor). */
export async function friendStatusShown(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  return await handleVisible(s, actorId, Handles.friendStatusFriends(username));
}

/** The screen offers to confirm `fromUsername`'s request (focuses the actor). */
export async function confirmOffered(
  s: ProductHarness,
  actorId: string,
  fromUsername: string
): Promise<boolean> {
  return await handleVisible(s, actorId, Handles.friendConfirm(fromUsername));
}

/** The screen offers to withdraw the request to `toUsername` (focuses the actor). */
export async function withdrawOffered(
  s: ProductHarness,
  actorId: string,
  toUsername: string
): Promise<boolean> {
  await showKnownPerson(s, actorId, toUsername);
  return await handleVisible(s, actorId, Handles.friendCancel(toUsername));
}

/** The screen offers to ask `username` (Add) (focuses the actor). */
export async function askOffered(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  return await handleVisible(s, actorId, Handles.friendAdd(username));
}

/** The screen offers to unblock `username` (focuses the actor). */
export async function unblockOffered(
  s: ProductHarness,
  actorId: string,
  username: string
): Promise<boolean> {
  return await handleVisible(s, actorId, Handles.friendUnblock(username));
}

/** The friends list says there are no friends yet (focuses the actor). */
export async function friendsEmptyShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return await handleVisible(s, actorId, Handles.friendsEmpty);
}
