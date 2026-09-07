import { describe, test } from 'bun:test';
import {
  createSpace,
  expectActiveSpace,
  expectLobbyCard,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

describe('space friend join', () => {
  test('host creates; friend joins from lobby card', async () => {
    await using s = await openSim('space-friend-join');
    await setupFriendsPair(s);

    await s.apply(createSpace, 'alice');
    await s.apply(openSpacesTab, 'bob');
    await s.apply(expectLobbyCard, 'bob', aliceUsername);
    await s.apply(openLobbyCard, 'bob', aliceUsername);
    await s.apply(joinFromPrompt, 'bob');
    await s.apply(expectActiveSpace, 'bob');
  });
});
