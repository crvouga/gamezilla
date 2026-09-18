import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  lobbyCardVisible,
  returnToLobby,
  returnToTabs,
  signInWithGoogle,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { openSim } from '../src/test/setup/open-sim';

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
