import { describe, test } from '@jest/globals';

import { openSim } from '../setup/open-sim';
import { setupFriendsPair } from '../fixtures/setup-friends-pair';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');
    await setupFriendsPair(sim);
  }, 180_000);
});
