// goal:spaces:7
import { describe, expect, test } from 'bun:test';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { aliceUsername } from '@libs/sim-harness/open-sim/fixtures';
import {
  createSpace,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
} from '@libs/spaces/sim/space-actions';
import {
  activeSpaceVisible,
  lobbyCardVisible,
} from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

describe('space friend join', () => {
  test('host creates; friend joins from lobby card', async () => {
    await using s = await openSim('space-friend-join');
    await setupFriendsPair(s);

    await s.apply(createSpace, 'alice');
    await s.apply(openSpacesTab, 'bob');
    await s.until((surf) => lobbyCardVisible(surf, 'bob', aliceUsername));
    await s.apply(openLobbyCard, 'bob', aliceUsername);
    await s.apply(joinFromPrompt, 'bob');
    expect(await s.read(activeSpaceVisible, 'bob')).toBe(true);
  });
});
