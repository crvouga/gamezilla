import type { OpenSim } from '../../setup/open-sim';
import { returnToTabs, signInWithDev } from '../../sim';

/** Sign up alice and return to tabs. */
export async function buildSignedInAlice(sim: OpenSim): Promise<void> {
  await sim.apply(signInWithDev, 'alice');
  await sim.apply(returnToTabs, 'alice');
}
