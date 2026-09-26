/**
 * Friends steps: requests, the friends list, another person's profile,
 * blocking, and the live-space badge. Each step is one sim call or a fixed
 * short sequence; the wording says the intent, the sim layer does the UI.
 */

import { expect } from 'bun:test';

import {
  acceptFriendRequest,
  addFriend,
  blockFriend,
  cancelFriendRequest,
  declineFriendRequest,
  openFriendLiveSpace,
  openFriendsList,
  removeFriend,
  unblockFriend,
} from '@libs/friends/sim/friends-actions';
import {
  friendLiveBadgeVisible,
  friendRequestCardVisible,
  friendRowVisible,
  handleText,
  handleVisible,
  readFriendsCount,
} from '@libs/friends/sim/friends-ui-reads';
import {
  blockPerson,
  keepFriend,
  openAcceptedNotification,
  openPersonFromSearch,
  tapFriendPill,
  viewProfileFromRequest,
} from '@libs/friends/sim/person-actions';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { searchUsername } from '@libs/search/sim/search-actions';
import { backToTabs, focusActor, returnToTabs } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { joinFromPrompt } from '@libs/spaces/sim/space-actions';
import { Handles } from '@libs/test-ids';

const SECOND_MS = 1_000;
const prompt = (handle: string): string => `${handle}-action`;

function sameActor(expected: Actor, given: Actor, step: string): void {
  if (expected !== given) {
    throw new Error(`${step}: expected ${expected}'s profile, got ${given}'s`);
  }
}

async function accountId(w: SimWorld, actor: Actor): Promise<string> {
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
    await w.s.apply(searchUsername, from, to);
    await w.s.apply(addFriend, from, to);
    await w.s.until((surf) => friendRequestCardVisible(surf, to, from));
  }
);

Given(
  "{actor} has sent {actor} a friend request from {actor}'s profile",
  async (w, from: Actor, to: Actor, whose: Actor) => {
    sameActor(to, whose, 'has sent … from profile');
    await w.s.apply(openPersonFromSearch, from, to);
    await w.s.apply(tapFriendPill, from, Handles.friendAdd(to));
    await w.s.until((surf) => friendRequestCardVisible(surf, to, from));
  }
);

When(
  '{actor} sends {actor} a friend request',
  async (w, from: Actor, to: Actor) => {
    await w.s.apply(searchUsername, from, to);
    await w.s.apply(addFriend, from, to);
  }
);

When(
  "{actor} sends {actor} a friend request from {actor}'s profile",
  async (w, from: Actor, to: Actor, whose: Actor) => {
    sameActor(to, whose, 'sends … from profile');
    await w.s.apply(tapFriendPill, from, Handles.friendAdd(to));
  }
);

When(
  "{actor} accepts {actor}'s friend request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.until((surf) => friendRequestCardVisible(surf, actor, from));
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

When('{actor} asks {actor} again', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(backToTabs, actor);
  await w.s.apply(searchUsername, actor, other);
  await w.s.apply(tapFriendPill, actor, Handles.friendAdd(other));
});

Then(
  "{actor}'s request to {actor} is refused with {string}",
  async (w, actor: Actor, other: Actor, reason: string) => {
    expect(await w.s.read(handleText, actor, Handles.friendAdd(other))).toBe(
      reason
    );
  }
);

// ------------------------------------------------------------ friends list

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
    expect(await w.s.read(friendRowVisible, actor, person)).toBe(true);
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
  '{actor} watches {person} appear in their friends list within {int} seconds',
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

Then(
  "{actor} is shown {actor}'s profile",
  async (w, actor: Actor, other: Actor) => {
    expect(await w.s.read(handleText, actor, Handles.friendUserUsername)).toBe(
      `@${other}`
    );
  }
);

When(
  "{actor} views {actor}'s request",
  async (w, actor: Actor, from: Actor) => {
    await w.s.apply(viewProfileFromRequest, actor, from);
  }
);

When(
  "{actor} confirms {actor}'s request from {actor}'s profile",
  async (w, actor: Actor, from: Actor, whose: Actor) => {
    sameActor(from, whose, 'confirms … from profile');
    await w.s.apply(tapFriendPill, actor, Handles.friendConfirm(from));
  }
);

When(
  "{actor} declines {actor}'s request from {actor}'s profile",
  async (w, actor: Actor, from: Actor, whose: Actor) => {
    sameActor(from, whose, 'declines … from profile');
    await w.s.apply(tapFriendPill, actor, Handles.friendDecline(from));
  }
);

Then(
  '{actor} sees {actor} as a friend',
  async (w, actor: Actor, other: Actor) => {
    expect(
      await w.s.read(handleVisible, actor, Handles.friendStatusFriends(other))
    ).toBe(true);
  }
);

Then(
  '{actor} sees {actor} as a friend within {int} seconds',
  async (w, actor: Actor, other: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until(
      (surf) => handleVisible(surf, actor, Handles.friendStatusFriends(other)),
      { maxMs: seconds * SECOND_MS }
    );
  }
);

Then(
  "{actor} is offered to confirm {actor}'s request",
  async (w, actor: Actor, from: Actor) => {
    expect(
      await w.s.read(handleVisible, actor, Handles.friendConfirm(from))
    ).toBe(true);
  }
);

Then(
  "{actor} is offered to confirm {actor}'s request within {int} seconds",
  async (w, actor: Actor, from: Actor, seconds: number) => {
    await w.s.until(
      (surf) => handleVisible(surf, actor, Handles.friendConfirm(from)),
      { maxMs: seconds * SECOND_MS }
    );
  }
);

Then(
  '{actor} can withdraw the request to {actor}',
  async (w, actor: Actor, to: Actor) => {
    expect(await w.s.read(handleVisible, actor, Handles.friendCancel(to))).toBe(
      true
    );
  }
);

Then(
  '{actor} can ask {actor} again within {int} seconds',
  async (w, actor: Actor, other: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until(
      (surf) => handleVisible(surf, actor, Handles.friendAdd(other)),
      {
        maxMs: seconds * SECOND_MS,
      }
    );
  }
);

// ------------------------------------------------------------------ remove

When('{actor} removes {actor}', async (w, actor: Actor, other: Actor) => {
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

When('{actor} blocks {actor}', async (w, actor: Actor, other: Actor) => {
  await w.s.apply(blockFriend, actor, other);
  await w.s.apply(returnToTabs, actor);
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

Then('{actor} can unblock {actor}', async (w, actor: Actor, other: Actor) => {
  expect(
    await w.s.read(handleVisible, actor, Handles.friendUnblock(other))
  ).toBe(true);
});

// ------------------------------------------------------------------- gates

Then('{actor} is told search needs an account', async (w, actor: Actor) => {
  expect(await w.s.read(handleVisible, actor, Handles.searchDenied)).toBe(true);
});

When(
  '{actor} follows the sign-in prompt from search',
  async (w, actor: Actor) => {
    await w.s.apply(tapFriendPill, actor, prompt(Handles.searchDenied));
  }
);

Then('{actor} is asked to sign in', async (w, actor: Actor) => {
  expect(await w.s.read(handleVisible, actor, Handles.authMethodGoogle)).toBe(
    true
  );
});

Then(
  '{actor} is asked to sign in within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(
      (surf) => handleVisible(surf, actor, Handles.authMethodGoogle),
      {
        maxMs: seconds * SECOND_MS,
      }
    );
  }
);

Then(
  '{actor} is told they have no friends yet within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until(
      (surf) => handleVisible(surf, actor, Handles.friendsEmpty),
      {
        maxMs: seconds * SECOND_MS,
      }
    );
  }
);

When('{actor} follows the find-friends prompt', async (w, actor: Actor) => {
  await w.s.apply(tapFriendPill, actor, prompt(Handles.friendsEmpty));
});

Then('{actor} can search for people', async (w, actor: Actor) => {
  expect(await w.s.read(handleVisible, actor, Handles.searchInput)).toBe(true);
});

// -------------------------------------------------------------- live badge

Then(
  "{actor}'s friends list does not badge {actor} as live",
  async (w, actor: Actor, host: Actor) => {
    const hostId = await accountId(w, host);
    expect(await w.s.read(friendLiveBadgeVisible, actor, hostId)).toBe(false);
  }
);

Then(
  "{actor}'s friends list badges {actor} as live within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const hostId = await accountId(w, host);
    await w.s.apply(focusActor, actor);
    await w.s.until(
      (surf: ProductSim) => friendLiveBadgeVisible(surf, actor, hostId),
      {
        maxMs: seconds * SECOND_MS,
      }
    );
  }
);

Then(
  "{actor}'s friends list stops badging {actor} as live within {int} seconds",
  async (w, actor: Actor, host: Actor, seconds: number) => {
    const hostId = await accountId(w, host);
    await w.s.apply(focusActor, actor);
    await w.s.apply(openFriendsList, actor);
    await w.s.until(
      (surf: ProductSim) => friendLiveBadgeVisible(surf, actor, hostId),
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
    const hostId = await accountId(w, host);
    await w.s.apply(openFriendLiveSpace, actor, hostId);
    await w.s.apply(joinFromPrompt, actor);
  }
);
