import { returnToTabs, signInWithDev } from '../../../sim';
import type { OpenSim } from '../../setup/open-sim';
import { buildSignedInAlice } from './signed-in-alice';

/** Alice + bob signed in, not friends. */
export async function buildSignedInPair(sim: OpenSim): Promise<void> {
  await buildSignedInAlice(sim);
  await sim.apply(signInWithDev, 'bob');
  await sim.apply(returnToTabs, 'bob');
}
