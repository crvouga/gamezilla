import { describe, test } from 'bun:test';

import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

describe('friends request → accept', () => {
  test('alice sends request; bob accepts from notifications; both see friends', async () => {
    await using sim = await openSim('friends-request-accept');
    await setupFriendsPair(sim);
  });
});
