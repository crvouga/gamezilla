import { Handles } from '@libs/test-ids';
import {
  acceptFriendRequest,
  addFriend,
  friendRowVisible,
  openFriendsList,
  returnToTabs,
  searchUsername,
  visible,
} from '../../../sim';
import { aliceUsername, bobUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
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
  await sim.until((s) => friendRowVisible(s, 'alice', bobUsername));
  await sim.apply(returnToTabs, 'alice');
  await sim.apply(openFriendsList, 'bob');
  await sim.until((s) => friendRowVisible(s, 'bob', aliceUsername));
  await sim.apply(returnToTabs, 'bob');
}
