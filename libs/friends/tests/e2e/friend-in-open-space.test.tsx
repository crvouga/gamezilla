// goal:social:6
// goal:spaces:7
import { describe, expect, test } from 'bun:test';

import { openFriendsList } from '@libs/friends/sim/friends-actions';
import { friendRowVisible } from '@libs/friends/sim/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { focusActor } from '@libs/sim-harness';
import { aliceUsername } from '@libs/sim-harness/open-sim/fixtures';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import {
  createSpace,
  endSpace,
  joinFromPrompt,
} from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { defineAction } from '@pkgs/sim';
import { openSim } from './support/open-friends-sim';

async function liveBadgeVisible(
  s: ProductSim,
  actorId: string,
  hostAccountId: string
): Promise<boolean> {
  const ui = s.actors.get(actorId)?.ui;
  if (ui === undefined) return false;
  return await ui.get(Handles.friendLiveSpace(hostAccountId)).isVisible();
}

const tapLiveBadge = defineAction({
  name: 'tapFriendLiveSpace',
  act: async (s: ProductSim, actorId: string, hostAccountId: string) => {
    const ui = s.actors.get(actorId)?.ui;
    if (ui === undefined) throw new Error(`actor ${actorId} missing`);
    await ui.get(Handles.friendLiveSpace(hostAccountId)).tap();
    await ui.get(Handles.spaceJoin).expect.visible({ timeoutMs: 10_000 });
  },
});

const closeSpace = defineAction({
  name: 'closeSpace',
  act: async (s: ProductSim, actorId: string) => {
    const ui = s.actors.get(actorId)?.ui;
    if (ui === undefined) throw new Error(`actor ${actorId} missing`);
    await ui.get(Handles.spaceClose).tap();
    await ui.get(Handles.spaceClose).expect.hidden({ timeoutMs: 10_000 });
  },
});

describe('friends in an open space', () => {
  test('bob sees alice is in an open space, live, and joins from his friends list', async () => {
    await using s = await openSim('friend-in-open-space');
    await setupFriendsPair(s);
    const alice = await s.read(accountIdOf, 'alice');
    expect(alice).not.toBeNull();
    const aliceId = alice ?? '';

    await s.apply(openFriendsList, 'bob');
    await s.until((surf) => friendRowVisible(surf, 'bob', aliceUsername));
    expect(await s.read(liveBadgeVisible, 'bob', aliceId)).toBe(false);

    // Alice opens a space: bob's list says so without him doing anything.
    await s.apply(focusActor, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(focusActor, 'bob');
    await s.until((surf) => liveBadgeVisible(surf, 'bob', aliceId), {
      maxMs: 15_000,
    });

    // No link needed: the badge takes him in.
    await s.apply(tapLiveBadge, 'bob', aliceId);
    await s.apply(joinFromPrompt, 'bob');
    expect(await s.read(activeSpaceVisible, 'bob')).toBe(true);
    // Out of the space, back where he came from (his friends list).
    await s.apply(closeSpace, 'bob');

    // When the space ends, the badge goes with it.
    await s.apply(focusActor, 'alice');
    await s.apply(endSpace, 'alice');
    await s.apply(focusActor, 'bob');
    await s.apply(openFriendsList, 'bob');
    await s.until((surf) => liveBadgeVisible(surf, 'bob', aliceId), {
      pred: (visible) => !visible,
      maxMs: 15_000,
    });
  });
});
