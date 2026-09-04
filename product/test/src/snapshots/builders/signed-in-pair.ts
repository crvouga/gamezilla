import { AppDriver } from '../../drivers/app-driver';
import { bobCreds } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import { buildSignedInAlice } from './signed-in-alice';

/** Alice + bob signed in, not friends. */
export async function buildSignedInPair(sim: OpenSim): Promise<void> {
  await buildSignedInAlice(sim);
  const bob = await AppDriver.forActor(sim, 'bob');
  await bob.auth.signInWithDev(bobCreds);
  await bob.auth.returnToTabs();
}
