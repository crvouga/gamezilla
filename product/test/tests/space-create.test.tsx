import { describe, test } from 'bun:test';

import { aliceUsername } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';
import {
  createSpace,
  expectLobbyCard,
  returnToLobby,
  returnToTabs,
  signInWithDev,
} from '../src/sim';

describe('space create', () => {
  test('host creates a space and sees it in the lobby', async () => {
    await using s = await openSim('space-create');

    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(returnToLobby, 'alice');
    await s.apply(expectLobbyCard, 'alice', aliceUsername);
  });
});
