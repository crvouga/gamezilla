import { Handles } from '@libs/test-ids';

import { aliceUsername, bobUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import {
  acceptFriendRequest,
  addFriend,
  expectFriend,
  openFriendsList,
  searchUsername,
  visible,
} from '../../sim';
import { buildSignedInPair } from './signed-in-pair';

/** Alice + bob signed in and friends. */
export async function buildFriendsPair(sim: OpenSim): Promise<void> {
  await buildSignedInPair(sim);

  await sim.apply(searchUsername, 'alice', bobUsername);
  await sim.until(
    (s) => visible(s, 'alice', [Handles.friendAdd(bobUsername)]),
    { maxMs: 10_000, stepMs: 500 }
  );
  await sim.apply(addFriend, 'alice', bobUsername);
  await sim.apply(acceptFriendRequest, 'bob', aliceUsername);

  await sim.apply(openFriendsList, 'alice');
  await sim.apply(expectFriend, 'alice', bobUsername);
  await sim.apply(openFriendsList, 'bob');
  await sim.apply(expectFriend, 'bob', aliceUsername);
}
