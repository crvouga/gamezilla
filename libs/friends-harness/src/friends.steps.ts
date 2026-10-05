/**
 * Friends steps: requests, the friends list, another person's profile,
 * blocking, and the live-space badge. Each step is one harness call or a fixed
 * short sequence; the wording says the intent, the harness layer does the UI.
 */

import { expect } from 'bun:test';
import { returnToTabs } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf, signedInAccountOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { openInbox } from '@libs/notifications-harness/notifications-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness/profile-actions';
import { searchUsername } from '@libs/search-harness/search-actions';
import {
  peopleSearchOpen,
  searchNeedsAccount,
} from '@libs/search-harness/search-ui-reads';
import {
  closeSpaceScreen,
  joinFromPrompt,
} from '@libs/spaces-harness/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness/spaces-ui-reads';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  openFriendLiveSpace,
  openFriendsList,
  removeFriend,
  searchUntilAddOffered,
  unblockFriend,
} from './friends-actions';
import {
  addFriendLabel,
  askOffered,
  confirmOffered,
  friendLiveBadgeVisible,
  friendRequestCardVisible,
  friendRequestNeedsConnection,
  friendRowVisible,
  friendStatusShown,
  friendsEmptyShown,
  personProfileShown,
  readFriendsCount,
  unblockOffered,
  withdrawOffered,
} from './friends-ui-reads';
import {
  askAgainFromSearch,
  blockPerson,
  confirmFromProfile,
  declineFromProfile,
  followFindFriends,
  followSearchSignIn,
  keepFriend,
  openAcceptedNotification,
  openPersonFromSearch,
  sendRequestFromProfile,
  viewProfileFromRequest,
} from './person-actions';
import { setupBlock } from './setup-block';
import { prepareNamedFriend, setupFriendRequest } from './setup-friend-request';
import { setupFriendsPair } from './setup-friends-pair';

const SECOND_MS = 1_000;
/** How long a decline takes to reach the person who asked. */
const DECLINE_REACHES_MS = 15_000;

function sameActor(expected: Actor, given: Actor, step: string): void {
  if (expected !== given) {
    throw new Error(`${step}: expected ${expected}'s profile, got ${given}'s`);
  }
}

async function accountId(w: HarnessWorld, actor: Actor): Promise<string> {
  const id = await w.s.read(accountIdOf, actor);
  if (id === null) throw new Error(`${actor} has no account`);
  return id;
}

// ---------------------------------------------------------------- requests

Given('{actor} and {actor} are friends', async (w, a: Actor, b: Actor) => {
  await setupFriendsPair(w.s, a, b);
});

Given(
  '{actor} has sent {actor} a friend request',
  async (w, from: Actor, to: Actor) => {
    await setupFriendRequest(w.s, from, to);
  }
);

Given(
  "{actor} has sent {actor} a friend request from {actor}'s profile",
  async (w, from: Actor, to: Actor, whose: Actor) => {
    sameActor(to, whose, 'has sent … from profile');
    await w.s.apply(openPersonFromSearch, from, to);
    await w.s.apply(sendRequestFromProfile, from, to);
    await w.s.until((surf) => friendRequestCardVisible(surf, to, from));
  }
);

Given(
  "{actor} has accepted {actor}'s friend request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(acceptFriendRequest, actor, from);
  }
);

Given(
  "{actor} has declined {actor}'s friend request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(declineFriendRequest, actor, from);
    await w.s.apply(backToTabs, from);
    await w.s.apply(searchUntilAddOffered, from, actor, DECLINE_REACHES_MS);
  }
);

When(
  "{actor} sends {actor} a friend request from {actor}'s profile",
  async (w, from: Actor, to: Actor, whose: Actor) => {
    sameActor(to, whose, 'sends … from profile');
    await w.s.apply(sendRequestFromProfile, from, to);
  }
);

When(
  "{actor} accepts {actor}'s friend request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(acceptFriendRequest, actor, from);
  }
);

When(
  "{actor} declines {actor}'s friend request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(declineFriendRequest, actor, from);
  }
);

When(
  '{actor} cancels the friend request to {actor}',
  async (w, actor: Actor, to: Actor) => {
    await w.s.apply(cancelFriendRequest, actor, to);
  }
);

Given(
  '{actor} has cancelled the friend request to {actor}',
  async (w, actor: Actor, to: Actor) => {
    await w.s.apply(cancelFriendRequest, actor, to);
    // The asker can ask again before the scenario does.
    await w.s.apply(backToTabs, actor);
    await w.s.apply(searchUntilAddOffered, actor, to, DECLINE_REACHES_MS);
  }
);

When('{actor} asks {actor} again', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(backToTabs, actor);
  await w.s.apply(askAgainFromSearch, actor, other);
});

Then(
  '{actor} is told friend requests need a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => friendRequestNeedsConnection(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s request to {actor} is refused with {string}",
  async (w, actor: Actor, other: Actor, reason: string) => {
    expect(await w.s.read(addFriendLabel, actor, other)).toBe(reason);
  }
);

// ------------------------------------------------------------ friends list

// A rename other people then look for (profile owns the act of renaming).
Given(
  '{actor} has renamed themselves to {username}',
  async (w, actor: Actor, username: string) => {
    await w.s.apply(openProfileEdit, actor);
    await w.s.apply(setUsername, actor, username);
  }
);

When('{actor} opens their friends list', async (w, actor: Actor) => {
  await w.s.apply(openFriendsList, actor);
});

Given(
  '{actor} is viewing their friends list with {person} in it',
  async (w, actor: Actor, person: string) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person));
  }
);

Then(
  "{actor}'s friends list shows {person}",
  async (w, actor: Actor, person: string) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person));
  }
);

Then(
  "{actor}'s friends list shows {person} within {int} seconds",
  async (w, actor: Actor, person: string, seconds: number) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s friends list does not show {person}",
  async (w, actor: Actor, person: string) => {
    await w.s.apply(openFriendsList, actor);
    expect(await w.s.read(friendRowVisible, actor, person)).toBe(false);
  }
);

Then(
  "{actor}'s friends list stops showing {person} within {int} seconds",
  async (w, actor: Actor, person: string, seconds: number) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person), {
      pred: (visible) => !visible,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} sees {person} appear in their friends list within {int} seconds',
  async (w, actor: Actor, person: string, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => friendRowVisible(surf, actor, person), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{person} is gone from {actor}'s open friends list",
  async (w, person: string, actor: Actor) => {
    expect(await w.s.read(friendRowVisible, actor, person)).toBe(false);
  }
);

Then(
  "{actor}'s friend count is {int}",
  async (w, actor: Actor, count: number) => {
    expect(await w.s.read(readFriendsCount, actor)).toBe(String(count));
  }
);

// ------------------------------------------------------------------- inbox

Given('{actor} is viewing their inbox', async (w, actor: Actor) => {
  await w.s.apply(openInbox, actor);
});

When('{actor} opens their inbox', async (w, actor: Actor) => {
  await w.s.apply(openInbox, actor);
});

Then(
  "{actor}'s inbox shows a friend request from {actor} within {int} seconds",
  async (w, actor: Actor, from: Actor, seconds: number) => {
    await w.s.until((surf) => friendRequestCardVisible(surf, actor, from), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s inbox does not show a friend request from {actor}",
  async (w, actor: Actor, from: Actor) => {
    expect(await w.s.read(friendRequestCardVisible, actor, from)).toBe(false);
  }
);

Then(
  "{actor}'s inbox stops showing the friend request from {actor} within {int} seconds",
  async (w, actor: Actor, from: Actor, seconds: number) => {
    await w.s.until((surf) => friendRequestCardVisible(surf, actor, from), {
      pred: (visible) => !visible,
      maxMs: seconds * SECOND_MS,
    });
  }
);

When(
  '{actor} opens the notice that {actor} accepted',
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(openAcceptedNotification, actor, other);
  }
);

// --------------------------------------------------- another person's profile

When('{actor} looks up {actor}', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(openPersonFromSearch, actor, other);
});

Given(
  "{actor} is viewing {actor}'s profile",
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(openPersonFromSearch, actor, other);
  }
);

Given(
  "{actor} has opened {actor}'s profile from their request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(viewProfileFromRequest, actor, from);
  }
);

Then(
  "{actor} is shown {actor}'s profile",
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(personProfileShown, actor)).toBe(`@${other}`);
  }
);

When(
  "{actor} views {actor}'s request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(viewProfileFromRequest, actor, from);
  }
);

When(
  "{actor} accepts {actor}'s request from {actor}'s profile",
  async (w, actor: Actor, from: Actor, whose: Actor) => {
    sameActor(from, whose, 'accepts … from profile');
    await w.s.apply(confirmFromProfile, actor, from);
  }
);

When(
  "{actor} declines {actor}'s request from {actor}'s profile",
  async (w, actor: Actor, from: Actor, whose: Actor) => {
    sameActor(from, whose, 'declines … from profile');
    await w.s.apply(declineFromProfile, actor, from);
  }
);

Then(
  '{actor} sees {actor} as a friend',
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(friendStatusShown, actor, other)).toBe(true);
  }
);

Then(
  "{actor} is offered to accept {actor}'s request",
  async (w, actor: Actor, from: Actor) => {
    expect(await w.s.read(confirmOffered, actor, from)).toBe(true);
  }
);

Then(
  "{actor} is offered to accept {actor}'s request within {int} seconds",
  async (w, actor: Actor, from: Actor, seconds: number) => {
    await w.s.until((surf) => confirmOffered(surf, actor, from), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} can cancel the request to {actor}',
  async (w, actor: Actor, to: Actor) => {
    expect(await w.s.read(withdrawOffered, actor, to)).toBe(true);
  }
);

Then(
  '{actor} can ask {actor} again within {int} seconds',
  async (w, actor: Actor, other: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => askOffered(surf, actor, other), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

// ------------------------------------------------------------------ remove

When('{actor} removes {actor}', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(removeFriend, actor, other);
  await w.s.apply(returnToTabs, actor);
});

Given('{actor} has removed {actor}', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(removeFriend, actor, other);
  await w.s.apply(returnToTabs, actor);
});

When(
  '{actor} starts removing {actor} but keeps them',
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(openPersonFromSearch, actor, other);
    await w.s.apply(keepFriend, actor, other);
  }
);

// ------------------------------------------------------------------- block

async function block(
  w: HarnessWorld,
  actor: Actor,
  other: Actor
): Promise<void> {
  // Someone looking at a space steps out of it (staying in it) to search.
  await w.s.apply(focusActor, actor);
  if (await w.s.read(activeSpaceVisible, actor))
    await w.s.apply(closeSpaceScreen, actor);
  await w.s.apply(backToTabs, actor);
  await w.s.apply(openPersonFromSearch, actor, other);
  await w.s.apply(blockPerson, actor, other);
}

When('{actor} blocks {actor}', async (w, actor: Actor, other: Actor) => {
  await block(w, actor, other);
});

Given('{actor} has blocked {actor}', async (w, actor: Actor, other: Actor) => {
  // Only a named account can be found and blocked; someone the scenario has
  // not met yet becomes one first.
  if ((await w.s.read(signedInAccountOf, other)) === null)
    await prepareNamedFriend(w.s, other);
  await w.s.apply(setupBlock, actor, other);
});

When(
  '{actor} blocks {actor} from their request',
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(viewProfileFromRequest, actor, other);
    await w.s.apply(blockPerson, actor, other);
  }
);

When('{actor} unblocks {actor}', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(backToTabs, actor);
  await w.s.apply(unblockFriend, actor, other);
});

Given(
  '{actor} has unblocked {actor}',
  async (w, actor: Actor, other: Actor) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(unblockFriend, actor, other);
  }
);

Then('{actor} can unblock {actor}', async (w, actor: Actor, other: Actor) => {
  expect(await w.s.read(unblockOffered, actor, other)).toBe(true);
});

// ------------------------------------------------------------------- gates

Then('{actor} is told search needs an account', async (w, actor: Actor) => {
  expect(await w.s.read(searchNeedsAccount, actor)).toBe(true);
});

Given(
  '{actor} has searched for {string}',
  async (w, actor: Actor, text: string) => {
    await w.s.apply(backToTabs, actor);
    await w.s.apply(searchUsername, actor, text);
  }
);

When('{actor} chooses to sign in from search', async (w, actor: Actor) => {
  await w.s.apply(followSearchSignIn, actor);
});

Then(
  '{actor} is told they have no friends yet within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => friendsEmptyShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Given(
  '{actor} is viewing their empty friends list',
  async (w, actor: Actor) => {
    await w.s.apply(openFriendsList, actor);
    await w.s.until((surf) => friendsEmptyShown(surf, actor));
  }
);

When('{actor} chooses to find friends', async (w, actor: Actor) => {
  await w.s.apply(followFindFriends, actor);
});

Then('{actor} can search for people', async (w, actor: Actor) => {
  expect(await w.s.read(peopleSearchOpen, actor)).toBe(true);
});

// -------------------------------------------------------------- live badge

/** Bring `actor`'s friends list up and wait until it shows `host` as live. */
async function untilShownLive(
  w: HarnessWorld,
  actor: Actor,
  host: Actor,
  maxMs?: number
): Promise<void> {
  const hostId = await accountId(w, host);
  await w.s.apply(focusActor, actor);
  await w.s.apply(openFriendsList, actor);
  await w.s.until(
    (surf: ProductHarness) => friendLiveBadgeVisible(surf, actor, hostId),
    maxMs === undefined ? undefined : { maxMs }
  );
}

Given(
  "{actor}'s friends list shows {actor} as live",
  async (w, actor: Actor, host: Actor) => {
    await untilShownLive(w, actor, host);
  }
);

Then(
  "{actor}'s friends list shows {actor} as live within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const hostId = await accountId(w, host);
    await w.s.apply(focusActor, actor);
    await w.s.until(
      (surf: ProductHarness) => friendLiveBadgeVisible(surf, actor, hostId),
      { maxMs: seconds * SECOND_MS }
    );
  }
);

Then(
  "{actor}'s friends list stops showing {actor} as live within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const hostId = await accountId(w, host);
    await w.s.apply(focusActor, actor);
    await w.s.apply(openFriendsList, actor);
    await w.s.until(
      (surf: ProductHarness) => friendLiveBadgeVisible(surf, actor, hostId),
      {
        pred: (visible) => !visible,
        maxMs: seconds * SECOND_MS,
      }
    );
  }
);

When(
  "{actor} joins {actor}'s space from their friends list",
  async (w, actor: Actor, host: Actor) => {
    await untilShownLive(w, actor, host);
    await w.s.apply(openFriendLiveSpace, actor, await accountId(w, host));
    await w.s.apply(joinFromPrompt, actor);
  }
);
