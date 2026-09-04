import { AppDriver } from '../../drivers/app-driver';
import { aliceCreds } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';

/** Sign up alice and return to tabs. */
export async function buildSignedInAlice(sim: OpenSim): Promise<void> {
  const alice = await AppDriver.forActor(sim, 'alice');
  await alice.auth.signInWithDev(aliceCreds);
  await alice.auth.returnToTabs();
}
