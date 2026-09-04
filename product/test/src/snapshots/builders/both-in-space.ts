import { aliceUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import {
  createSpace,
  expectLobbyCard,
  joinFromPrompt,
  openLobbyCard,
  openSpacesTab,
} from '../../sim';
import { buildFriendsPair } from './friends-pair';

/** Friends in an active space (alice host, bob joined). */
export async function buildBothInSpace(sim: OpenSim): Promise<void> {
  await buildFriendsPair(sim);
  await sim.apply(createSpace, 'alice');
  await sim.apply(openSpacesTab, 'bob');
  await sim.apply(expectLobbyCard, 'bob', aliceUsername);
  await sim.apply(openLobbyCard, 'bob', aliceUsername);
  await sim.apply(joinFromPrompt, 'bob');
}
