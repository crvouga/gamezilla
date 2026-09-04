import { describe, test } from '@jest/globals';

import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');
    await setupFriendsPair(sim);
  }, 30_000);
});
