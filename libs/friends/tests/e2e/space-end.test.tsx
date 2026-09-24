import { describe, expect, test } from 'bun:test';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { aliceUsername } from '@libs/sim-harness/open-sim/fixtures';
import {
  createSpace,
  endSpace,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
  reenterActiveSpace,
} from '@libs/spaces/sim/space-actions';
import { lobbyCardVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

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
