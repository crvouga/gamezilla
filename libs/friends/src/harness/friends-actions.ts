import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import { searchUsername } from '@libs/search/harness/search-actions';
import { Handles } from '@libs/test-ids';

const WAIT_MS = 10_000;
const HIDDEN_MS = 5_000;

export const acceptFriendRequest = scenarioAction({
  name: 'acceptFriendRequest',
  act: async (s, actorId: string, fromUsername: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabNotifications).tap();
    const card = Handles.notificationsFriendRequestCard(fromUsername);
    await ui.get(card).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    const accept = Handles.notificationsFriendRequestAccept(fromUsername);
    await ui.get(accept).tap({ timeoutMs: WAIT_MS });
    await ui.get(accept).expect.hidden({ timeoutMs: HIDDEN_MS });
    await ui.get(card).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const declineFriendRequest = scenarioAction({
  name: 'declineFriendRequest',
  act: async (s, actorId: string, fromUsername: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabNotifications).tap({ timeoutMs: WAIT_MS });
    const card = Handles.notificationsFriendRequestCard(fromUsername);
    await ui.get(card).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(card).tap({ timeoutMs: WAIT_MS });
    const decline = Handles.notificationsFriendRequestDecline(fromUsername);
    await ui.get(decline).tap({ timeoutMs: WAIT_MS });
    await ui.get(card).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const cancelFriendRequest = scenarioAction({
  name: 'cancelFriendRequest',
  act: async (s, actorId: string, toUsername: string) => {
    const ui = await actorUi(s, actorId);
    const cancel = Handles.friendCancel(toUsername);
    await ui.get(cancel).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(cancel).tap({ timeoutMs: WAIT_MS });
    await ui.get(cancel).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

async function openFriendProfile(
  s: Parameters<typeof actorUi>[0],
  actorId: string,
  username: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: WAIT_MS,
  });
  if (
    !(await ui.get(Handles.tabProfile).isVisible()) &&
    (await ui.get(Handles.navBack).isVisible())
  ) {
    await ui.get(Handles.navBack).tap();
  }
  await ui.get(Handles.tabProfile).tap();
  await ui
    .get(Handles.profileFriendsStats)
    .expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.profileFriendsStats).tap();
  await s.session.waitForIdle();
  const row = Handles.friendsListRow(username);
  await ui.get(row).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(row).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.friendStatusFriends(username)).expect.visible({
    timeoutMs: WAIT_MS,
  });
}

export const removeFriend = scenarioAction({
  name: 'removeFriend',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await openFriendProfile(s, actorId, username);
    await ui.get('header-overflow-menu').tap({ timeoutMs: WAIT_MS });
    const remove = Handles.friendRemove(username);
    await ui.get(remove).tap({ timeoutMs: WAIT_MS });
    const confirm = Handles.friendRemoveConfirm(username);
    await ui.get(confirm).tap({ timeoutMs: WAIT_MS });
    await ui.get(confirm).expect.hidden({ timeoutMs: HIDDEN_MS });
    await ui.get(Handles.friendsListRow(username)).expect.hidden({
      timeoutMs: HIDDEN_MS,
    });
  },
});

export const blockFriend = scenarioAction({
  name: 'blockFriend',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await openFriendProfile(s, actorId, username);
    await ui.get('header-overflow-menu').tap({ timeoutMs: WAIT_MS });
    const block = Handles.friendBlock(username);
    await ui.get(block).tap({ timeoutMs: WAIT_MS });
    const confirm = Handles.friendBlockConfirm(username);
    await ui.get(confirm).tap({ timeoutMs: WAIT_MS });
    await ui.get(confirm).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const unblockFriend = scenarioAction({
  name: 'unblockFriend',
  act: async (s, actorId: string, username: string) => {
    await Promise.resolve(searchUsername.act(s, actorId, username));
    const ui = await actorUi(s, actorId);
    const unblock = Handles.friendUnblock(username);
    await ui.get(unblock).expect.visible({ timeoutMs: WAIT_MS });
    await ui.get(unblock).tap({ timeoutMs: WAIT_MS });
    await ui.get(unblock).expect.hidden({ timeoutMs: HIDDEN_MS });
  },
});

export const openFriendsList = scenarioAction({
  name: 'openFriendsList',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).expect.visible({
      timeoutMs: WAIT_MS,
    });
    if (
      !(await ui.get(Handles.tabProfile).isVisible()) &&
      (await ui.get(Handles.navBack).isVisible())
    ) {
      await ui.get(Handles.navBack).tap();
    }
    await ui.get(Handles.tabProfile).tap();
    await ui.get(Handles.profileFriendsStats).expect.visible({
      timeoutMs: WAIT_MS,
    });
    await ui.get(Handles.profileFriendsStats).tap();
  },
});

/** After `searchUsername`: the result row's Add pill (friends fills search's slot). */
export const addFriend = scenarioAction({
  name: 'addFriend',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.friendAdd(username)).expect.visible({
      timeoutMs: WAIT_MS,
    });
    await ui.get(Handles.friendAdd(username)).tap();
  },
});

/** On the friends list: tap a friend's live-space badge; lands on the join prompt. */
export const openFriendLiveSpace = scenarioAction({
  name: 'openFriendLiveSpace',
  act: async (s, actorId: string, hostAccountId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.friendLiveSpace(hostAccountId)).tap();
    await ui.get(Handles.spaceJoin).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Search for `username` again and again until their row offers Add — what a
 * person does after a decline or cancel reaches them. Fails after `maxMs`.
 */
export const searchUntilAddOffered = scenarioAction({
  name: 'searchUntilAddOffered',
  act: async (s, actorId: string, username: string, maxMs: number) => {
    const ui = await actorUi(s, actorId);
    await pollUntil(
      s,
      async () => {
        await Promise.resolve(searchUsername.act(s, actorId, username));
        return (await ui.get(Handles.friendAdd(username)).isVisible())
          ? true
          : null;
      },
      { maxMs, description: `search offers to add ${username}` }
    );
  },
});

export const FRIENDS_HARNESS_ACTIONS = [
  searchUntilAddOffered,
  openFriendLiveSpace,
  addFriend,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockFriend,
  unblockFriend,
  openFriendsList,
];
