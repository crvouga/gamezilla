import { describe, test } from 'bun:test';

import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { openSim } from './support/open-friends-sim';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');
    await setupFriendsPair(sim);
  });
});
