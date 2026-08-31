import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import {
  aliceCreds,
  aliceUsername,
  bobCreds,
  bobUsername,
} from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('friends request → decline', () => {
  test('alice sends request; bob declines from notifications; neither is friends', async () => {
    await using sim = await openSim('friends-request-decline');

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signInWithDev(aliceCreds);
    await alice.auth.returnToTabs();

    const bob = await AppDriver.forActor(sim, 'bob');
    await bob.auth.signInWithDev(bobCreds);
    await bob.auth.returnToTabs();

    // Dev sign-in subject → ensureProfile username (same as accept scenario).
    await alice.search.expectUserVisible(bobUsername);
    await alice.search.addFriend(bobUsername);

    await bob.notifications.expectIncomingFriendRequest(aliceUsername);
    await bob.notifications.declineFriendRequest(aliceUsername);

    await alice.friends.expectNotFriend(bobUsername);

    await bob.friends.expectNotFriend(aliceUsername);
  }, 30_000);
});
