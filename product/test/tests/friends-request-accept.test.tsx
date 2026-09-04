import { describe, test } from 'bun:test';

import { setupFriendsPair } from '../src/fixtures/setup-friends-pair';
import { openSim } from '../src/setup/open-sim';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');
    await setupFriendsPair(sim);
  });
});
