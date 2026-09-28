/**
 * `specs/friends/friendships.als` against what the product stores: the
 * server's database and every device's own copy, read back after each
 * scripted friendships scenario, and after every step of a few traces Quint
 * draws from `specs/friends/friendship.qnt` (see `friendships-projection.ts`).
 */

import '../quint/friendship.binding';

import { bindStructure } from '@pkgs/alloy/registry';

import { openHarness } from '../harness/open-friends-harness';
import { FRIENDSHIP_SCENARIOS } from './friends-scenarios';
import { projectFriendships } from './friendships-projection';
import { quintWalks } from './snapshot-quint-walks';
import { captureWorlds, once } from './snapshot-worlds';

const worlds = once(() =>
  captureWorlds(
    openHarness,
    [
      ...FRIENDSHIP_SCENARIOS,
      ...quintWalks({
        packageName: '@libs/friends',
        specUri: 'specs/friends/friendship.qnt',
        traces: 2,
        maxSteps: 6,
      }),
    ],
    projectFriendships
  )
);

bindStructure({
  spec: 'friendships',
  snapshots: {
    'server database': async () => (await worlds()).server,
    'device database': async () => (await worlds()).device,
  },
});
