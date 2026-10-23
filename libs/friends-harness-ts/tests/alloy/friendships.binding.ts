/**
 * `specs/friends/friendships.als` against what the product stores: the
 * server's database and every device's own copy, read after every step of
 * one trace of `specs/friends/friendship.qnt`: of the traces Quint draws, the
 * one passing through every situation a fact of the structure is about (see
 * `friendship-walk-score.ts`, and `friendships-projection.ts`). Both adapters
 * read the same run.
 */

import '../quint/friendship.binding';

import { quintWalk } from '@libs/harness-ts/quint-walk';
import { captureWorlds, sharedWorlds } from '@libs/harness-ts/snapshot-worlds';
import { bindStructure } from '@pkgs/alloy-shared-ts/registry';

import { openHarness } from '../open-friends-harness';
import { friendshipWalkScore } from './friendship-walk-score';
import { projectFriendships } from './friendships-projection';

const worlds = sharedWorlds('friendships', () =>
  captureWorlds(
    openHarness,
    [
      quintWalk({
        packageName: '@libs/friends',
        specUri: 'specs/friends/friendship.qnt',
        maxSteps: 8,
        score: friendshipWalkScore,
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
