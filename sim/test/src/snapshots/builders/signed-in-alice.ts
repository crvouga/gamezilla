import { AppDriver } from '../../drivers/app-driver';
import { aliceCreds } from '../../fixtures/fixtures';
import type { OpenSimHandle } from '../../setup/open-sim';

/** Sign up alice and return to tabs. */
export async function buildSignedInAlice(sim: OpenSimHandle): Promise<void> {
  const alice = await AppDriver.forActor(sim, 'alice');
  await alice.auth.signUpWithEmail(aliceCreds);
  await alice.auth.returnToTabs();
}
