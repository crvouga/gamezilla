/**
 * Another person's profile (`/profile/user/:id`) and the ways to reach it:
 * a search result, the friend-request modal's View profile, the accepted
 * notification. Every action here ends on — or acts on — that screen.
 */

import { searchUsername } from '@libs/search/sim/search-actions';
import { actorUi, scenarioAction } from '@libs/sim-harness/system/actor-ui';
import { Handles } from '@libs/test-ids';

const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;
/** `ScreenBase`'s ⋯ button (design-system chrome, not a feature handle). */
const OVERFLOW_MENU = 'header-overflow-menu';

type Surface = Parameters<typeof actorUi>[0];

async function expectPersonScreen(
  s: Surface,
  actorId: string,
  username: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.friendUserUsername)
    .expect.text(`@${username}`, { timeoutMs: WAIT_MS });
}

/** Search for `username`, then tap their row: their profile opens. */
export const openPersonFromSearch = scenarioAction({
  name: 'openPersonFromSearch',
  act: async (s, actorId: string, username: string) => {
    await Promise.resolve(searchUsername.act(s, actorId, username));
    const ui = await actorUi(s, actorId);
    const row = Handles.searchUserResultOpen(username);
    await ui.get(row).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(row).tap({ timeoutMs: WAIT_MS });
    await expectPersonScreen(s, actorId, username);
  },
});

/** Inbox → the request from `fromUsername` → View profile. */
export const viewProfileFromRequest = scenarioAction({
  name: 'viewProfileFromRequest',
  act: async (s, actorId: string, fromUsername: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: WAIT_MS });
    const card = Handles.notificationsFriendRequestCard(fromUsername);
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.notificationsFriendRequestViewProfile(fromUsername))
      .tap({ timeoutMs: WAIT_MS });
    await expectPersonScreen(s, actorId, fromUsername);
  },
});

/** Inbox → "@username accepted your friend request": their profile opens. */
export const openAcceptedNotification = scenarioAction({
  name: 'openAcceptedNotification',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: WAIT_MS });
    const card = Handles.notificationsFriendAcceptedCard(username);
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    await expectPersonScreen(s, actorId, username);
  },
});

/** Tap a pill (Add, Requested, Confirm, Delete, Unblock) and let it settle. */
export const tapFriendPill = scenarioAction({
  name: 'tapFriendPill',
  act: async (s, actorId: string, pillHandle: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(pillHandle).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/**
 * On their profile: Block → confirm. Block sits behind ⋯ beside Remove
 * friend, and alone in the header otherwise (a menu never holds one item).
 * Lands back where the person came from.
 */
export const blockPerson = scenarioAction({
  name: 'blockPerson',
  act: async (s, actorId: string, username: string) => {
    await expectPersonScreen(s, actorId, username);
    const ui = await actorUi(s, actorId);
    if (await ui.get(OVERFLOW_MENU).isVisible()) {
      await ui.get(OVERFLOW_MENU).tap({ timeoutMs: WAIT_MS });
    }
    await ui.get(Handles.friendBlock(username)).tap({ timeoutMs: WAIT_MS });
    const confirm = Handles.friendBlockConfirm(username);
    await ui.get(confirm).tap({ timeoutMs: WAIT_MS });
    await ui.get(confirm).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

/** On their profile: ⋯ → Remove friend → change your mind. */
export const keepFriend = scenarioAction({
  name: 'keepFriend',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(OVERFLOW_MENU).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.friendRemove(username)).tap({ timeoutMs: WAIT_MS });
    const cancel = Handles.friendRemoveCancel(username);
    await ui.get(cancel).tap({ timeoutMs: WAIT_MS });
    await ui.get(cancel).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const PERSON_SIM_ACTIONS = [
  openPersonFromSearch,
  viewProfileFromRequest,
  openAcceptedNotification,
  tapFriendPill,
  blockPerson,
  keepFriend,
];
