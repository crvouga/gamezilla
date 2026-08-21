import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import {
  aliceCreds,
  aliceUsername,
  bobCreds,
  bobUsername,
} from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');

    const alice = await AppDriver.forActor(sim, 'alice');

    await alice.auth.signUpWithEmail(aliceCreds);
    await alice.auth.returnToTabs();
    await alice.profile.openEdit();
    await alice.profile.setUsername(aliceUsername);
    await alice.profile.expectUsername(aliceUsername);
    await alice.park();

    const bob = await AppDriver.forActor(sim, 'bob');
    await bob.auth.signUpWithEmail(bobCreds);
    await bob.auth.returnToTabs();
    await bob.profile.openEdit();
    await bob.profile.setUsername(bobUsername);
    await bob.profile.expectUsername(bobUsername);
    await bob.park();

    await alice.resume();
    await alice.search.expectUserVisible(bobUsername);
    await alice.search.addFriend(bobUsername);
    await alice.park();

    await bob.resume();
    await bob.notifications.expectIncomingFriendRequest(aliceUsername);
    await bob.notifications.acceptFriendRequest(aliceUsername);
    await bob.park();

    await alice.resume();
    await alice.friends.openList();
    await alice.friends.expectFriend(bobUsername);
    await alice.park();

    await bob.resume();
    await bob.friends.openList();
    await bob.friends.expectFriend(aliceUsername);
  }, 180_000);
});
