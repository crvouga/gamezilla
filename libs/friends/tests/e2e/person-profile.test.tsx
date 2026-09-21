// goal:social:5
/**
 * Another person's profile is where you decide about them: it opens from a
 * search result or from their request, says who they are, and carries the
 * same Add / Requested / Confirm / Delete / Friends pills as search.
 */
import { describe, expect, test } from 'bun:test';

import {
  friendRequestCardVisible,
  handleText,
  handleVisible,
  readFriendsCount,
} from '@libs/friends/sim/friends-ui-reads';
import {
  openPersonFromSearch,
  tapFriendPill,
  viewProfileFromRequest,
} from '@libs/friends/sim/person-actions';
import { focusActor } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';
import { signInPair } from './support/sign-in-pair';

const LIVE_MS = 15_000;

describe('another person’s profile', () => {
  test('ask from their profile, answer from theirs: both become friends and the counts say so', async () => {
    await using s = await openSim('person-profile-befriend');
    await signInPair(s);
    expect(await s.read(readFriendsCount, 'alice')).toBe('0');

    await s.apply(openPersonFromSearch, 'alice', bobUsername);
    expect(await s.read(handleText, 'alice', Handles.friendUserUsername)).toBe(
      `@${bobUsername}`
    );
    await s.apply(tapFriendPill, 'alice', Handles.friendAdd(bobUsername));
    expect(
      await s.read(handleVisible, 'alice', Handles.friendCancel(bobUsername))
    ).toBe(true);

    // Bob looks alice up: the pills already know she asked.
    await s.apply(openPersonFromSearch, 'bob', aliceUsername);
    await s.until(
      (surf) =>
        handleVisible(surf, 'bob', Handles.friendConfirm(aliceUsername)),
      { maxMs: LIVE_MS }
    );
    await s.apply(tapFriendPill, 'bob', Handles.friendConfirm(aliceUsername));
    expect(
      await s.read(
        handleVisible,
        'bob',
        Handles.friendStatusFriends(aliceUsername)
      )
    ).toBe(true);

    // Alice is still on bob's profile: it turns to Friends by itself.
    await s.apply(focusActor, 'alice');
    await s.until(
      (surf) =>
        handleVisible(surf, 'alice', Handles.friendStatusFriends(bobUsername)),
      { maxMs: LIVE_MS }
    );
    expect(await s.read(readFriendsCount, 'alice')).toBe('1');
    expect(await s.read(readFriendsCount, 'bob')).toBe('1');
  });

  test('a request’s View profile shows who is asking; Delete there turns it down', async () => {
    await using s = await openSim('person-profile-from-request');
    await signInPair(s);
    await s.apply(openPersonFromSearch, 'alice', bobUsername);
    await s.apply(tapFriendPill, 'alice', Handles.friendAdd(bobUsername));
    await s.until((surf) =>
      friendRequestCardVisible(surf, 'bob', aliceUsername)
    );

    await s.apply(viewProfileFromRequest, 'bob', aliceUsername);
    expect(
      await s.read(handleVisible, 'bob', Handles.friendConfirm(aliceUsername))
    ).toBe(true);
    await s.apply(tapFriendPill, 'bob', Handles.friendDecline(aliceUsername));
    await s.until((surf) =>
      handleVisible(surf, 'bob', Handles.friendAdd(aliceUsername))
    );
    // Turned down: the request left bob's inbox, and nobody is a friend.
    expect(await s.read(friendRequestCardVisible, 'bob', aliceUsername)).toBe(
      false
    );
    expect(await s.read(readFriendsCount, 'bob')).toBe('0');
    expect(await s.read(readFriendsCount, 'alice')).toBe('0');
  });
});
