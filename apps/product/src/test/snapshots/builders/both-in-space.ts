import {
  createSpace,
  joinFromPrompt,
  lobbyCardVisible,
  openLobbyCard,
  openSpacesTab,
} from '../../../sim';
import { aliceUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import { buildFriendsPair } from './friends-pair';

/** Friends in an active space (alice host, bob joined). */
export async function buildBothInSpace(sim: OpenSim): Promise<void> {
  await buildFriendsPair(sim);
  await sim.apply(createSpace, 'alice');
  await sim.apply(openSpacesTab, 'bob');
  await sim.until((s) => lobbyCardVisible(s, 'bob', aliceUsername));
  await sim.apply(openLobbyCard, 'bob', aliceUsername);
  await sim.apply(joinFromPrompt, 'bob');
}
