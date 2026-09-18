import { returnToTabs, signInWithGoogle } from '../../../sim';
import type { OpenSim } from '../../setup/open-sim';

/** Sign up alice and return to tabs. */
export async function buildSignedInAlice(sim: OpenSim): Promise<void> {
  await sim.apply(signInWithGoogle, 'alice');
  await sim.apply(returnToTabs, 'alice');
}
