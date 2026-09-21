import { describe, expect, test } from 'bun:test';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { aliceUsername } from '@libs/sim-harness/open-sim/fixtures';
import { createSpace, returnToLobby } from '@libs/spaces/sim/space-actions';
import { lobbyCardVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

describe('space create', () => {
  test('host creates a space and sees it in the lobby', async () => {
    await using s = await openSim('space-create');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(returnToLobby, 'alice');
    await s.until((surf) => lobbyCardVisible(surf, 'alice', aliceUsername));
    expect(await s.read(lobbyCardVisible, 'alice', aliceUsername)).toBe(true);
  });
});
