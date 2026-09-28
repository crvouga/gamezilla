/**
 * Scripted worlds for the friendships structure: people sign in, ask,
 * answer, unfriend and block through the same harness actions the friends
 * steps and the friendship Quint binding use.
 */

import {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  removeFriend,
  unblockFriend,
} from '@libs/friends/harness/friends-actions';
import { friendRequestCardVisible } from '@libs/friends/harness/friends-ui-reads';
import {
  blockPerson,
  openPersonFromSearch,
} from '@libs/friends/harness/person-actions';
import { setupFriendsPair } from '@libs/friends/harness/setup-friends-pair';
import {
  backToTabs,
  focusActor,
  returnToTabs,
  signInWithGoogle,
} from '@libs/harness';
import type { OpenHarness } from '@libs/harness/open-harness/open-harness';
import { searchUsername } from '@libs/search/harness/search-actions';

import type { Scenario } from './snapshot-worlds';

export async function signIn(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(signInWithGoogle, actor);
  await s.apply(returnToTabs, actor);
}

async function toTabs(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(focusActor, actor);
  await s.apply(backToTabs, actor);
}

/** `from` asks `to`, and the request reaches `to`'s inbox. */
export async function ask(
  s: OpenHarness,
  from: string,
  to: string
): Promise<void> {
  await toTabs(s, from);
  await s.apply(searchUsername, from, to);
  await s.apply(addFriend, from, to);
  await s.until((h) => friendRequestCardVisible(h, to, from));
}

export async function block(
  s: OpenHarness,
  blocker: string,
  blocked: string
): Promise<void> {
  await toTabs(s, blocker);
  await s.apply(openPersonFromSearch, blocker, blocked);
  await s.apply(blockPerson, blocker, blocked);
}

async function unfriend(
  s: OpenHarness,
  actor: string,
  other: string
): Promise<void> {
  await toTabs(s, actor);
  await s.apply(removeFriend, actor, other);
}

export const FRIENDSHIP_SCENARIOS: readonly Scenario[] = [
  {
    name: 'Alice and Bob are friends, and Carol has asked Alice',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await signIn(s, 'carol');
      await ask(s, 'carol', 'alice');
    },
  },
  {
    name: 'Carol asked Bob, and Bob blocked Carol before answering',
    run: async (s) => {
      await signIn(s, 'bob');
      await signIn(s, 'carol');
      await ask(s, 'carol', 'bob');
      await block(s, 'bob', 'carol');
    },
  },
  {
    name: 'Alice blocked her friend Bob',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await block(s, 'alice', 'bob');
    },
  },
  {
    name: 'Alice removed Bob, Bob declined Carol, and Carol accepted Alice',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await unfriend(s, 'alice', 'bob');
      await signIn(s, 'carol');
      await ask(s, 'carol', 'bob');
      await toTabs(s, 'bob');
      await s.apply(declineFriendRequest, 'bob', 'carol');
      await ask(s, 'alice', 'carol');
      await toTabs(s, 'carol');
      await s.apply(acceptFriendRequest, 'carol', 'alice');
    },
  },
  {
    name: 'Bob blocked Alice and then unblocked her, and Alice asked again',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await block(s, 'bob', 'alice');
      await toTabs(s, 'bob');
      await s.apply(unblockFriend, 'bob', 'alice');
      await ask(s, 'alice', 'bob');
    },
  },
];
