import { describe, test } from 'bun:test';
import {
  createSpace,
  endSpace,
  expectLobbyCard,
  expectLobbyCardGone,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
  reenterActiveSpace,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import { setupFriendsPair } from '../src/test/fixtures/setup-friends-pair';
import { openSim } from '../src/test/setup/open-sim';

async function setupBothInActiveSpace(
  s: Awaited<ReturnType<typeof openSim>>
): Promise<void> {
  await setupFriendsPair(s);
  await s.apply(createSpace, 'alice');
  await s.apply(openSpacesTab, 'bob');
  await s.apply(expectLobbyCard, 'bob', aliceUsername);
  await s.apply(openLobbyCard, 'bob', aliceUsername);
  await s.apply(joinFromPrompt, 'bob');
}

describe('space end', () => {
  test('host ends; guest sees ended state', async () => {
    await using s = await openSim('space-end');
    await setupBothInActiveSpace(s);

    await s.apply(reenterActiveSpace, 'alice', aliceUsername);
    await s.apply(endSpace, 'alice');
    await s.apply(expectLobbyCardGone, 'bob', aliceUsername);
  });
});
