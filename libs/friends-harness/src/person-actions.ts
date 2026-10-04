/**
 * Another person's profile (`/profile/user/:id`) and the ways to reach it:
 * a search result, the friend-request modal's View profile, the accepted
 * notification. Every action here ends on — or acts on — that screen.
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { searchUsername } from '@libs/search-harness/search-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { USER_SEARCH_DEBOUNCE_MS } from '@libs/user-search-shared/user-search-types';

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
    await pollUntil(
      s,
      async () => ((await ui.get(row).isVisible()) ? true : null),
      {
        maxMs: WAIT_MS,
        stepMs: USER_SEARCH_DEBOUNCE_MS,
        description: `open ${username} from search`,
      }
    );
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

/** Tap one of the friend pills on the screen and let the answer settle. */
async function tapPill(
  s: Surface,
  actorId: string,
  pill: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(pill).tap({ timeoutMs: WAIT_MS });
  await s.session.waitForIdle();
}

/**
 * On `username`'s profile: Add. Someone not already looking at it goes there
 * the way a person does, through search.
 */
export const sendRequestFromProfile = scenarioAction({
  name: 'sendRequestFromProfile',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    const onProfile =
      (await ui.get(Handles.friendUserUsername).isVisible()) &&
      (await ui.get(Handles.friendUserUsername).text()) === `@${username}`;
    if (!onProfile) {
      await Promise.resolve(openPersonFromSearch.act(s, actorId, username));
    }
    await tapPill(s, actorId, Handles.friendAdd(username));
  },
});

/** On the asker's profile: Confirm their incoming request. */
export const confirmFromProfile = scenarioAction({
  name: 'confirmFromProfile',
  act: async (s, actorId: string, fromUsername: string) => {
    await tapPill(s, actorId, Handles.friendConfirm(fromUsername));
  },
});

/** On the asker's profile: Delete (decline) their incoming request. */
export const declineFromProfile = scenarioAction({
  name: 'declineFromProfile',
  act: async (s, actorId: string, fromUsername: string) => {
    await tapPill(s, actorId, Handles.friendDecline(fromUsername));
  },
});

/** Search for `username` and ask them again from their result row's Add. */
export const askAgainFromSearch = scenarioAction({
  name: 'askAgainFromSearch',
  act: async (s, actorId: string, username: string) => {
    await Promise.resolve(searchUsername.act(s, actorId, username));
    await tapPill(s, actorId, Handles.friendAdd(username));
  },
});

/** A guest's people search: follow its Sign in prompt. */
export const followSearchSignIn = scenarioAction({
  name: 'followSearchSignIn',
  act: async (s, actorId: string) => {
    await tapPill(s, actorId, `${Handles.searchDenied}-action`);
  },
});

/** An empty friends list: follow its Find friends prompt. */
export const followFindFriends = scenarioAction({
  name: 'followFindFriends',
  act: async (s, actorId: string) => {
    await tapPill(s, actorId, `${Handles.friendsEmpty}-action`);
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

export const PERSON_HARNESS_ACTIONS = [
  openPersonFromSearch,
  viewProfileFromRequest,
  openAcceptedNotification,
  sendRequestFromProfile,
  confirmFromProfile,
  declineFromProfile,
  askAgainFromSearch,
  followSearchSignIn,
  followFindFriends,
  blockPerson,
  keepFriend,
];
