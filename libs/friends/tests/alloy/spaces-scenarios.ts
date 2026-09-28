/**
 * Scripted worlds for the spaces structure: friends and strangers host,
 * join (from the lobby or a link), step out, leave and end spaces through
 * the same harness actions the spaces steps and the space-hosting Quint
 * binding use.
 */

import { setupFriendsPair } from '@libs/friends/harness/setup-friends-pair';
import { focusActor } from '@libs/harness';
import type { OpenHarness } from '@libs/harness/open-harness/open-harness';
import {
  createSpace,
  endSpace,
  joinFromLobby,
  joinViaLink,
  leaveSpace,
  openSpacesTab,
  returnToLobby,
} from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';

import { signIn } from './friends-scenarios';
import type { Scenario } from './snapshot-worlds';

async function host(s: OpenHarness, actor: string): Promise<string> {
  await s.apply(focusActor, actor);
  await s.apply(createSpace, actor);
  const link = await s.read(readSpaceLink, actor);
  if (link === null) throw new Error(`${actor} opened no space`);
  return link;
}

async function joinFriend(
  s: OpenHarness,
  actor: string,
  friend: string
): Promise<void> {
  await s.apply(focusActor, actor);
  await s.apply(openSpacesTab, actor);
  await s.apply(joinFromLobby, actor, friend);
}

async function end(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(focusActor, actor);
  await s.apply(endSpace, actor);
}

export const SPACES_SCENARIOS: readonly Scenario[] = [
  {
    name: 'Alice hosts a space Bob joined from the lobby, beside Carol',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await signIn(s, 'carol');
      await host(s, 'alice');
      await joinFriend(s, 'bob', 'alice');
    },
  },
  {
    name: 'Alice ended her space after Bob joined, and Bob hosts his own',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await host(s, 'alice');
      await joinFriend(s, 'bob', 'alice');
      await end(s, 'alice');
      await s.apply(openSpacesTab, 'bob');
      await host(s, 'bob');
    },
  },
  {
    name: 'Bob stepped out of Alice space, and then left it',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await host(s, 'alice');
      await joinFriend(s, 'bob', 'alice');
      await s.apply(returnToLobby, 'bob');
      await joinFriend(s, 'bob', 'alice');
      await s.apply(leaveSpace, 'bob');
    },
  },
  {
    name: 'Alice left her own space after Bob joined, which ended it',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await host(s, 'alice');
      await joinFriend(s, 'bob', 'alice');
      await s.apply(focusActor, 'alice');
      await s.apply(leaveSpace, 'alice');
    },
  },
  {
    name: 'a guest hosts a space that Bob, a guest too, joined from its link',
    run: async (s) => {
      const link = await host(s, 'alice');
      await s.apply(focusActor, 'bob');
      await s.apply(joinViaLink, 'bob', link);
    },
  },
  {
    name: 'Carol, a stranger, joined the space of Alice from its link',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await signIn(s, 'carol');
      const link = await host(s, 'alice');
      await s.apply(focusActor, 'carol');
      await s.apply(joinViaLink, 'carol', link);
    },
  },
  {
    name: 'Bob stepped out of the space of Alice and hosts his own',
    run: async (s) => {
      await setupFriendsPair(s, 'alice', 'bob');
      await host(s, 'alice');
      await joinFriend(s, 'bob', 'alice');
      await s.apply(returnToLobby, 'bob');
      await host(s, 'bob');
    },
  },
];
