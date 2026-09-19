// goal:social:5
import { describe, expect, test } from 'bun:test';

import { friendRowVisible, openFriendsList } from '../src/sim';
import { bobUsername } from '../src/test/fixtures/fixtures';
import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

describe('friends request → decline/cancel', () => {
  test('friend lifecycle starts from a synchronized relationship', async () => {
    await using sim = await openSim('friends-request-decline-cancel');
    await setupFriendsPair(sim);
    await sim.apply(openFriendsList, 'alice');
    await sim.until((surf) => friendRowVisible(surf, 'alice', bobUsername));
    expect(await sim.read(friendRowVisible, 'alice', bobUsername)).toBe(true);
  });
});
