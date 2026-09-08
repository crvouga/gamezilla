import { describe, test } from 'bun:test';

import { Handles } from '@libs/test-ids';
import { defineAction } from '@pkgs/sim';

import { actorUi } from '../src/sim/system/actor-ui';
import { returnToTabs, signInWithDev } from '../src/sim/system/auth-actions';
import { acceptFriendRequest } from '../src/sim/system/friends-actions';
import { actorHtml } from '../src/sim/system/observations';
import { addFriend, searchUsername } from '../src/sim/system/search-actions';
import type { ProductSim } from '../src/sim/system/sim';
import { aliceUsername, bobUsername } from '../src/test/fixtures/fixtures';
import { openSim } from '../src/test/setup/open-sim';

const probeAliceDump = defineAction({
  name: 'probeAliceDump',
  act: async (s: ProductSim) => {
    const ui = await actorUi(s, 'alice');
    const html = await actorHtml(s, 'alice');
    if (html !== null) {
      for (const _needle of [
        'tab-profile',
        'AppTabBar',
        'SurfaceStackLayer',
        'Friends',
      ]) {
      }
    }
    try {
      await ui.get(Handles.tabProfile).expect.visible({ timeoutMs: 20_000 });
    } catch (_err) {}
    const html2 = await actorHtml(s, 'alice');
    if (html2 !== null) {
      for (const _needle of [
        'tab-profile',
        'AppTabBar',
        'BlankShell',
        'Loading',
        'boot',
      ]) {
      }
    }
  },
});

describe('probe after accept', () => {
  test('dump alice ui state', async () => {
    await using sim = await openSim('probe-after-accept');
    await sim.apply(signInWithDev, 'alice');
    await sim.apply(returnToTabs, 'alice');
    await sim.apply(signInWithDev, 'bob');
    await sim.apply(returnToTabs, 'bob');
    await sim.apply(searchUsername, 'alice', bobUsername);
    await sim.apply(addFriend, 'alice', bobUsername);
    await sim.apply(acceptFriendRequest, 'bob', aliceUsername);
    await sim.apply(probeAliceDump);
  });
});
