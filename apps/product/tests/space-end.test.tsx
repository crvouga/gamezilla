import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  endSpace,
  joinFromPrompt,
  lobbyCardVisible,
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
  await s.until((surf) => lobbyCardVisible(surf, 'bob', aliceUsername));
  await s.apply(openLobbyCard, 'bob', aliceUsername);
  await s.apply(joinFromPrompt, 'bob');
}

describe('space end', () => {
  test('host ends; guest sees ended state', async () => {
    await using s = await openSim('space-end');
    await setupBothInActiveSpace(s);

    await s.apply(reenterActiveSpace, 'alice', aliceUsername);
    await s.apply(endSpace, 'alice');
    await s.apply(openSpacesTab, 'bob');
    await s.until((surf) => lobbyCardVisible(surf, 'bob', aliceUsername), {
      pred: (v) => !v,
      maxMs: 10_000,
    });
    expect(await s.read(lobbyCardVisible, 'bob', aliceUsername)).toBe(false);
  });
});
